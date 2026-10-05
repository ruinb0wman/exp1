buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// AGP 8.11.0 的默认 build-tools 是 35.0.0（ToolsRevisionUtils.DEFAULT_BUILD_TOOLS_REVISION），
// 本机只装了 36.0.0，而缺失的 35.0.0 又因 /opt/android-sdk 不可写 + 无 licenses 目录无法自动下载。
// tauri.settings.gradle 把 ~/.cargo/registry 里的 tauri-android / tauri-plugin-*/android 也 include
// 成了子项目（那些文件不可改），所以只能在这里统一指定。
subprojects {
    listOf("com.android.library", "com.android.application").forEach { id ->
        plugins.withId(id) {
            extensions.configure<com.android.build.gradle.BaseExtension> {
                buildToolsVersion = "36.0.0"
            }
        }
    }
}

tasks.register("clean").configure {
    delete("build")
}

