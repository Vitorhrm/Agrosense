import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { localProperties.load(it) }
}

android {
    namespace = "com.example.irri"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.example.irri"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        buildConfigField("String", "SUPABASE_URL", "\"${localProperties.getProperty("SUPABASE_URL", "")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProperties.getProperty("SUPABASE_ANON_KEY", "")}\"")
    }

    buildTypes {
        release {
            optimization {
                enable = true
                packageScope = setOf("androidx.**", "kotlin.**", "kotlinx.**")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)

    // Autenticação e consultas pelo controller Kotlin.
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    // Transporte HTTP usado pelo Supabase.
    implementation(libs.ktor.android)
    implementation(libs.ktor.core)
    
}


// Compila o React antes de empacotar o APK, inclusive ao clicar em Run no Android Studio.
val buildReactUi = tasks.register<Exec>("buildReactUi") {
    group = "build"
    description = "Verifica TypeScript e atualiza a interface React do aplicativo."
    workingDir(rootProject.projectDir)
    commandLine("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", rootProject.file("Atualizar-Figma.ps1").absolutePath)
    inputs.dir(rootProject.file("figma-ui/src"))
    inputs.files(rootProject.file("figma-ui/package.json"), rootProject.file("figma-ui/pnpm-lock.yaml"), rootProject.file("figma-ui/tsconfig.json"), rootProject.file("figma-ui/vite.android.config.ts"), rootProject.file("figma-ui/index.html"), rootProject.file("Atualizar-Figma.ps1"))
    outputs.dir(layout.projectDirectory.dir("src/main/assets/agrosense"))
}
tasks.configureEach { if (name.matches(Regex("merge.*Assets")) || name.contains("Lint") || name.startsWith("lint")) dependsOn(buildReactUi) }

