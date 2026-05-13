package com.stone.app

import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Follow the system dark-mode setting so status bar icons
    // are visible against the app's background (light vs dark).
    val isDarkMode = (resources.configuration.uiMode and
      Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    if (Build.VERSION.SDK_INT >= 35) {
      // ── Android 15+ (API 35+): system-enforced edge-to-edge ──
      // `setDecorFitsSystemWindows` is deprecated and has no effect.
      // Status bar background is always transparent; only icon appearance can be controlled.

      val controller = WindowInsetsControllerCompat(window, window.decorView)

      // Dark mode  -> white icons (app background is #111615)
      // Light mode -> black icons (app background is #EDF1F0)
      controller.isAppearanceLightStatusBars = !isDarkMode
      controller.isAppearanceLightNavigationBars = !isDarkMode

      // Manually apply system bar insets as padding so content doesn't draw underneath
      val contentView = findViewById<View>(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, insets ->
        val statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
        val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
        view.setPadding(
          view.paddingLeft,
          statusBarInsets.top,     // leave room for the status bar
          view.paddingRight,
          navBarInsets.bottom      // leave room for the navigation bar
        )
        insets
      }
    } else {
      // ── Android 14 and below: traditional approach ──
      WindowCompat.setDecorFitsSystemWindows(window, true)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        // Status bar colors are set by the DayNight theme (themes.xml / values-night/themes.xml)
      }
    }
  }
}
