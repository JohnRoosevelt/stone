plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.stone.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.stone.app"
        minSdk = 24
        targetSdk = 34
        versionCode = System.getenv("VERSION_CODE")?.toIntOrNull() ?: 1
        versionName = System.getenv("VERSION_NAME") ?: "0.1.0"
    }

    signingConfigs {
        create("release") {
            // Using absolute path from environment or default
            val path = System.getenv("KEYSTORE_PATH") ?: "../keystore.jks"
            storeFile = file(path)
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "stone123"
            keyAlias = System.getenv("KEY_ALIAS") ?: "upload"
            keyPassword = System.getenv("KEY_PASSWORD") ?: "stone123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            manifest.srcFile("src/main/AndroidManifest.xml")
            res.srcDirs("src/main/res")
            java.srcDirs("src/main/java")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    // FIXED: Corrected syntax for Gradle 8.13+ to avoid Type Mismatch
    val customBuildPath = "${rootProject.layout.buildDirectory.get()}/app/${projectDir.relativeTo(rootProject.projectDir)}/build"
    layout.buildDirectory.set(file(customBuildPath))
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.24")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.webkit:webkit:1.11.0")

    // Tauri
    implementation("app.tauri:tauri-android:0.2.3")
}

// Ensure tauri script is applied after the android block
apply(from = "${rootProject.projectDir}/tauri-android/tauri.android.kts")