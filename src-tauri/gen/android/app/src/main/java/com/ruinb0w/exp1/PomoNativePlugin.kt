package com.ruinb0w.exp1

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import app.tauri.Logger
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class AcquireWakeLockArgs {
  /** 超时毫秒数；到期后系统自动释放（兜底，防漏释放）。 */
  var timeoutMs: Long = 0
}

@InvokeArg
class NotifyCompletionArgs {
  var title: String = ""
  var body: String = ""
}

@InvokeArg
class SetCompletionAlarmArgs {
  var triggerAtMs: Long = 0
  var sessionId: Long = -1
  var taskId: String? = null
  var mode: String = "focus"
  var totalTime: Long = 0
  var title: String = ""
  var body: String = ""
}

/**
 * 番茄钟的原生能力（只由 Rust 侧调用，不暴露给前端 JS）。
 *
 * - partial wake lock：前台服务只保证「进程不被杀」，并不阻止 CPU 睡眠。灭屏后设备 suspend，
 *   单调时钟不再前进，纯 Rust 的 tokio 定时器会整个停摆 —— 所以计时期间要持锁。
 *   （注意：在部分定制 ROM 上系统仍会冻结应用并禁用该锁，所以它只是「尽量」，见下一条。）
 * - 到点精确闹钟：唯一能保证「灭屏 / 被冻结时也准点提醒」的机制，见 [PomoAlarmReceiver]。
 * - 完成提醒：应用不在前台时发一条高优先级、带声音的独立通知。
 */
@TauriPlugin
class PomoNativePlugin(private val activity: Activity) : Plugin(activity) {

  companion object {
    private const val WAKE_LOCK_TAG = "exp1:pomo"
    private const val ALARM_REQUEST_CODE = 9010

    /** 应用是否在前台；[PomoAlarmReceiver] 也读它来决定要不要发通知。 */
    @Volatile
    var isAppInForeground = false
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onResume() {
    isAppInForeground = true
    super.onResume()
  }

  override fun onStop() {
    isAppInForeground = false
    super.onStop()
  }

  private fun ensureWakeLock(): PowerManager.WakeLock {
    val existing = wakeLock
    if (existing != null) return existing
    val powerManager = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
    val created = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG)
    // 自己管重入：Rust 每次状态变化都会重新申请，用非引用计数语义更不容易漏放。
    created.setReferenceCounted(false)
    wakeLock = created
    return created
  }

  private fun alarmManager() =
    activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun alarmOperation(): PendingIntent = PendingIntent.getBroadcast(
    activity,
    ALARM_REQUEST_CODE,
    Intent(activity, PomoAlarmReceiver::class.java)
      .setAction(PomoAlarmReceiver.ACTION_POMO_COMPLETE),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  @Command
  fun acquireWakeLock(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(AcquireWakeLockArgs::class.java)
      val lock = ensureWakeLock()
      if (lock.isHeld) lock.release()
      if (args.timeoutMs > 0) lock.acquire(args.timeoutMs) else lock.acquire()
      Logger.verbose(Logger.tags("PomoNative"), "wake lock acquired (${args.timeoutMs}ms)")
      invoke.resolve()
    } catch (e: Exception) {
      Logger.error(Logger.tags("PomoNative"), "acquireWakeLock failed", e)
      invoke.reject("acquireWakeLock failed: ${e.message}")
    }
  }

  @Command
  fun releaseWakeLock(invoke: Invoke) {
    try {
      val lock = wakeLock
      if (lock != null && lock.isHeld) lock.release()
      invoke.resolve()
    } catch (e: Exception) {
      Logger.error(Logger.tags("PomoNative"), "releaseWakeLock failed", e)
      invoke.reject("releaseWakeLock failed: ${e.message}")
    }
  }

  /**
   * 设定到点闹钟。优先用 `setAlarmClock`（Doze 下也会被唤醒、不受 9 分钟限频），
   * 没有精确闹钟权限时退化为 `setAndAllowWhileIdle`（可能偏晚，但至少会响）。
   */
  @Command
  fun setCompletionAlarm(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(SetCompletionAlarmArgs::class.java)

      PomoAlarmReceiver.writeRecord(
        activity,
        sessionId = args.sessionId,
        taskId = args.taskId,
        mode = args.mode,
        totalTime = args.totalTime,
        triggerAtMs = args.triggerAtMs,
        title = args.title,
        body = args.body,
      )

      val manager = alarmManager()
      val operation = alarmOperation()
      manager.cancel(operation)

      val showIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
        ?.let {
          PendingIntent.getActivity(
            activity, 0, it,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
          )
        }

      val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
      if (canExact && showIntent != null) {
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(args.triggerAtMs, showIntent), operation)
      } else if (canExact) {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, args.triggerAtMs, operation)
      } else {
        // 无精确闹钟权限：仍要保证会响，只是可能晚几分钟
        Logger.warn(Logger.tags("PomoNative"), "no exact-alarm permission, falling back to inexact")
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, args.triggerAtMs, operation)
      }

      Logger.verbose(Logger.tags("PomoNative"), "completion alarm set at ${args.triggerAtMs}")
      invoke.resolve()
    } catch (e: Exception) {
      Logger.error(Logger.tags("PomoNative"), "setCompletionAlarm failed", e)
      invoke.reject("setCompletionAlarm failed: ${e.message}")
    }
  }

  @Command
  fun cancelCompletionAlarm(invoke: Invoke) {
    try {
      alarmManager().cancel(alarmOperation())
      PomoAlarmReceiver.clearRecord(activity)
      invoke.resolve()
    } catch (e: Exception) {
      Logger.error(Logger.tags("PomoNative"), "cancelCompletionAlarm failed", e)
      invoke.reject("cancelCompletionAlarm failed: ${e.message}")
    }
  }

  /** Rust 正常完成计时后调用，避免下次启动重复结算。 */
  @Command
  fun clearPendingCompletion(invoke: Invoke) {
    PomoAlarmReceiver.clearRecord(activity)
    invoke.resolve()
  }

  /**
   * 应用启动时取一次「上次计时」的记录：
   * - 已经过点（completed=true）→ 前端按正常完成补记；
   * - 还没到点（completed=false，说明计时中途被打断）→ 顺手撤掉系统闹钟，
   *   免得之后弹一条属于已废弃计时的通知。
   * 记录取完即清。
   */
  @Command
  fun takePendingCompletion(invoke: Invoke) {
    val record = PomoAlarmReceiver.takeRecord(activity)
    if (record == null) {
      invoke.resolve()
      return
    }

    val obj = JSObject(record)
    if (!obj.getBoolean("completed")) {
      alarmManager().cancel(alarmOperation())
    }
    invoke.resolve(obj)
  }

  @Command
  fun notifyCompletion(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(NotifyCompletionArgs::class.java)
      // 前台时前端会播提示音，不重复打扰
      if (!isAppInForeground) {
        PomoAlarmReceiver.postCompletionNotification(activity, args.title, args.body)
      }
      invoke.resolve()
    } catch (e: Exception) {
      Logger.error(Logger.tags("PomoNative"), "notifyCompletion failed", e)
      invoke.reject("notifyCompletion failed: ${e.message}")
    }
  }
}
