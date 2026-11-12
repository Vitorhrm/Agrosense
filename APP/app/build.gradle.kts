import java.util.Properties

plugins { alias(libs.plugins.android.application) }

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.example.agrosense"
    compileSdk { version = release(37) }
    defaultConfig {
        applicationId = "com.example.agrosense"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
}

// Run no Android Studio sempre verifica o TS e gera os assets atuais.
val buildReactUi = tasks.register<Exec>("buildReactUi") {
    group = "build"
    description = "Verifica TypeScript e empacota a interface React."
    workingDir(rootProject.projectDir)
    commandLine(localProperties.getProperty("NODE_BINARY", "node"), "scripts/build-frontend.mjs")
    inputs.dir(rootProject.file("frontend/src"))
    inputs.files(rootProject.file("frontend/package.json"), rootProject.file("frontend/package-lock.json"), rootProject.file("frontend/tsconfig.json"), rootProject.file("frontend/vite.config.ts"), rootProject.file("frontend/vite.android.config.ts"), rootProject.file("frontend/index.html"), rootProject.file("scripts/build-frontend.mjs"))
    inputs.files(rootProject.files("frontend/.env", "frontend/.env.local", "frontend/.env.production", "frontend/.env.production.local"))
    for (variable in listOf("VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_AGROSENSE_API_URL")) {
        inputs.property(variable, providers.environmentVariable(variable).orElse(""))
    }
    outputs.dir(layout.projectDirectory.dir("src/main/assets/agrosense"))
}
tasks.configureEach {
    if (name.matches(Regex("merge.*Assets")) || name.contains("lint", ignoreCase = true)) dependsOn(buildReactUi)
}

