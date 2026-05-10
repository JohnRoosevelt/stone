package com.stone.app

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      // 确保系统栏可以绘制背景色
      window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)

      // 设置状态栏和导航栏为不透明背景色
      window.statusBarColor = android.graphics.Color.parseColor("#1B2120")
      window.navigationBarColor = android.graphics.Color.parseColor("#1B2120")
    }

    // 防止内容绘制到系统栏下方（非 Android 15+ 有效）
    WindowCompat.setDecorFitsSystemWindows(window, true)
  }
}
