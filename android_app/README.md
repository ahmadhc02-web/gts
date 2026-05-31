# 📱 Green Tech Services (GTS) - Android Native WebView Wrapper & Bridge

Yeh complete compile-ready **Android Studio Project** hai jo aap ke full-stack GTS ISP Management Portal ko ek high-performance, responsive native Android App mein convert karta hai.

Sari files ko strictly is `android_app` folder ke andar build kiya gaya hai taake aap ka system fully modular rahe.

---

## ✨ Features Implemented

1. **🔒 Same Database & Logins (100% Shared State):**
   App directly aap ke secure production live engine URL (`https://mahmad995-my-wifi-app.hf.space`) ko load karegi, jis se database (Firestore), user profiles, login sessions, map indicators, aur real-time telemetry bina kisi modification ke identically sync rahenge.

2. **🔔 Native Android System Notifications:**
   Humne `MainActivity.kt` mein ek custom Native JavaScript Bridge (`AndroidInterface`) integrate kiya hai:
   * Jab bhi support portal par koi **system alert**, **fiber cut / node breakdown** ya **new chat message** ayega, to WebApp automatically background background system notifications trigger karegi.
   * Yeh notifications user ke device ke status bar aur notification shade/lock screen par real native messages ki tarah show honge, sound aur vibration ke sath!

3. **🔄 Native Pull-to-Refresh:**
   Humne native `SwipeRefreshLayout` support add kiya hai. Screen ko niche drag/swipe karne par network feeds aur diagnostics instant reset ho jayenge, bilkul standard apps ki tarah.

4. **⚡ Double-Loader Screen Control:**
   * Screen ke top par ek horizontal green loading line progress bar attach hai jo load accuracy show karta hai.
   * Screen ke center par ek rotating sleek progress loader hai jo content ready hote hi fade-out (hide) ho jata hai.

5. **📸 Camera & File Upload Integration:**
   Standard WebViews mein files upload buttons click karne par crash ho jate hain, isliye humne `WebChromeClient` aur `FileProvider` configures kiye hain taake field staff site photos, client profile pictures, aur OTDR readings direct access kar sakein.

6. **🔙 Smart Back-Press Navigation:**
   Back button press karne par app exit hone ke bajaye standard internal history go-back flow follow karegi aur direct exit hone se pehle screen par pop-up warning "Press back again to close App" flash hogi.

---

## 🛠️ How to Generate APK inside Android Studio (1 Minute Guide)

Aap default setup ke sath easily iska APK generate kar sakte hain:

### Step 1: Open Project in Android Studio
1. Apne laptop standard **Android Studio** open karein.
2. Select **Open** aur path select karein: `workspace/android_app` folder.
3. Android Studio automatic package parsing, gradle build, aur build indexing sync start kar dega.

### Step 2: Custom URL Setup (Optional)
Agar kal ko aap is portal ko kisi custom server domain ya static IP (jaise: `http://gts-isp.net`) par host karein, to `app/src/main/java/com/gts/isp/management/MainActivity.kt` open kar ke top variable ko easily edit kar sakte hain:
```kotlin
private val APP_URL = "https://your-custom-domain.com"
```

### Step 3: Build APK
1. Top Menu par click karein: **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
2. 30 se 45 seconds ke andar Android Studio project compile kar dega.
3. Bottom-right status corner par notification popup ayega: `APK(s) generated successfully.`
4. Click **"Locate"** to find your compiled installation file: `app-debug.apk` or `app-release.apk`!

### Step 4: Install & Enjoy!
Is APK file ko direct WhatsApp ya Web ke throw phone mein transfer karein, install karein (allow third-party installations if prompted) aur active lock-screen client notifications ke mazy lein!

---

## 🗂️ Project Directory Structure Included:
* `build.gradle` & `settings.gradle` - Project definitions and repositories selectors.
* `app/build.gradle` - Android dependency libraries (androidx appcompat, swiperefresh, material structure definitions).
* `app/src/main/AndroidManifest.xml` - Device permissions requests (Internet, Camera, Lock screen Notifications, storage providers registers).
* `app/src/main/res/layout/activity_main.xml` UI layouts setup (Horizontal + Centered progress bar structures).
* `app/src/main/res/values/` - colors, styles, string branding values.
