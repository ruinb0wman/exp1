package com.ruinb0w.exp1

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import app.tauri.Logger
import org.json.JSONObject

/**
 * 番茄钟「到点」闹钟的接收器。
 *
 * 为什么必须有它：前台服务 + wake lock 只能**降低**被冻结/被杀的概率，不能保证进程一直在跑。
 * 实测在 vivo OriginOS（Android 16）上，灭屏约 30 秒后系统会冻结应用并禁用它的 wake lock，
 * 进程内的 tokio 定时器随之停摆（倒计时数值仍正确 —— 见 pomo_timer 的截止时间戳方案，
 * 但「到点提醒」不会准时发出）。只有 AlarmManager 的精确闹钟能把设备唤醒并把进程拉起来执行
 * onReceive，这是唯一能保证准点提醒的机制。
 *
 * 注意「到点」的两种收尾是分开的，不能只靠 onReceive：
 * ① 提醒：onReceive 里发一条高优先级 + 声音的通知（应用在前台时跳过，前台由前端播提示音）。
 *    但实测部分 ROM（vivo OriginOS）**拒绝为广播拉起已死的后台进程** —— 闹钟会准点把设备唤醒
 *    （dumpsys alarm 的 wakeups 计数会 +1），广播却不会被投递。所以通知只保证「进程还活着」时可靠。
 * ② 补记：把本次计时的 (sessionId, mode, totalTime, triggerAtMs) 在**设闹钟时就**写进
 *    SharedPreferences，应用下次启动时由 [PomoAlarmReceiver.takeRecord] 自己比对时间戳：
 *    已经过点 = 那次番茄钟其实完成了 → 前端按「正常完成」补记（而不是当残留会话废弃）。
 *    这条路径完全不依赖广播，进程被杀也能生效。
 */
class PomoAlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_POMO_COMPLETE = "com.ruinb0w.exp1.POMO_COMPLETE"

    private const val PREFS_NAME = "pomo_native"
    private const val KEY_ALARM_TRIGGER_AT = "alarm_trigger_at_ms"
    private const val KEY_ALARM_SESSION_ID = "alarm_session_id"
    private const val KEY_ALARM_TASK_ID = "alarm_task_id"
    private const val KEY_ALARM_MODE = "alarm_mode"
    private const val KEY_ALARM_TOTAL_TIME = "alarm_total_time"
    private const val KEY_ALARM_TITLE = "alarm_title"
    private const val KEY_ALARM_BODY = "alarm_body"

    const val CHANNEL_ID = "pomo_complete_v1"
    private const val CHANNEL_NAME = "番茄钟提醒"
    const val NOTIFICATION_ID = 9010

    /** 记下本次计时（由 [PomoNativePlugin.setCompletionAlarm] 调用）。 */
    fun writeRecord(
      context: Context,
      sessionId: Long,
      taskId: String?,
      mode: String,
      totalTime: Long,
      triggerAtMs: Long,
      title: String,
      body: String,
    ) {
      prefs(context).edit()
        .putLong(KEY_ALARM_SESSION_ID, sessionId)
        .putString(KEY_ALARM_TASK_ID, taskId)
        .putString(KEY_ALARM_MODE, mode)
        .putLong(KEY_ALARM_TOTAL_TIME, totalTime)
        .putLong(KEY_ALARM_TRIGGER_AT, triggerAtMs)
        .putString(KEY_ALARM_TITLE, title)
        .putString(KEY_ALARM_BODY, body)
        .apply()
    }

    /** 忘掉本次计时（Rust 侧正常完成 / 取消闹钟时调用）。 */
    fun clearRecord(context: Context) {
      prefs(context).edit()
        .remove(KEY_ALARM_SESSION_ID)
        .remove(KEY_ALARM_TASK_ID)
        .remove(KEY_ALARM_MODE)
        .remove(KEY_ALARM_TOTAL_TIME)
        .remove(KEY_ALARM_TRIGGER_AT)
        .remove(KEY_ALARM_TITLE)
        .remove(KEY_ALARM_BODY)
        .apply()
    }

    /**
     * 取出并清空「上次计时」的记录（应用启动时由 Rust 调用，取完即清）。
     * `completed` = 已经过了截止时间，即那次番茄钟真的跑完了。
     * 返回 JSON 字符串；没有记录则返回 null。
     */
    fun takeRecord(context: Context): String? {
      val p = prefs(context)
      val sessionId = p.getLong(KEY_ALARM_SESSION_ID, -1)
      val triggerAtMs = p.getLong(KEY_ALARM_TRIGGER_AT, 0)
      if (sessionId <= 0 || triggerAtMs <= 0) {
        return null
      }

      val completed = System.currentTimeMillis() >= triggerAtMs
      val json = JSONObject().apply {
        put("sessionId", sessionId)
        put("taskId", p.getString(KEY_ALARM_TASK_ID, null))
        put("mode", p.getString(KEY_ALARM_MODE, "focus"))
        put("totalTime", p.getLong(KEY_ALARM_TOTAL_TIME, 0))
        put("triggerAtMs", triggerAtMs)
        put("completed", completed)
      }.toString()

      clearRecord(context)
      return json
    }

    fun prefs(context: Context) =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** 高优先级 + 声音的完成通知；与前台服务通知是不同 id，互不干扰。 */
    fun postCompletionNotification(context: Context, title: String, body: String) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_HIGH,
        )
        channel.enableVibration(true)
        manager.createNotificationChannel(channel)
      }

      val contentIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?.let {
          PendingIntent.getActivity(
            context, 0, it,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
          )
        }

      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(R.drawable.ic_pomo_notification)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setDefaults(NotificationCompat.DEFAULT_ALL)
        .apply { contentIntent?.let { setContentIntent(it) } }
        // 同一条通知可能被「闹钟接收器」和「Rust 正常完成」先后各发一次，只提醒一次
        .setOnlyAlertOnce(true)

      manager.notify(NOTIFICATION_ID, builder.build())
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_POMO_COMPLETE) {
      return
    }

    val prefs = prefs(context)
    val title = prefs.getString(KEY_ALARM_TITLE, "") ?: ""
    val body = prefs.getString(KEY_ALARM_BODY, "") ?: ""
    val sessionId = prefs.getLong(KEY_ALARM_SESSION_ID, -1)

    Logger.verbose(Logger.tags("PomoAlarm"), "alarm fired (session=$sessionId)")

    // 应用在前台时由前端播提示音，不重复打扰
    if (!PomoNativePlugin.isAppInForeground) {
      postCompletionNotification(context, title, body)
    }

    // 说明：这里不再写「待补记」——记录的读写都放在 setCompletionAlarm / takeRecord，
    // 因为本 ROM 上进程已死时广播不会被投递，靠 onReceive 落盘会漏。
  }
}
