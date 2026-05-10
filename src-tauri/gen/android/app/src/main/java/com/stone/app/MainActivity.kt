package com.stone.app

import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Prevent content from drawing behind the status bar
    WindowCompat.setDecorFitsSystemWindows(window, true)
  }
}
