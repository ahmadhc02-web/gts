package com.gts.isp.management

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    // IMPORTANT: Swap this URL with your custom production domain if needed!
    private val APP_URL = "https://mahmad995-my-wifi-app.hf.space"

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var horizontalProgressBar: ProgressBar
    private lateinit var centerProgressBar: ProgressBar

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoPath: String? = null
    private var doubleBackToExitPressedOnce = false

    private val CHANNEL_ID = "gts_isp_notifications"
    private val NOTIFICATION_PERMISSION_CODE = 101

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize Native Views
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        horizontalProgressBar = findViewById(R.id.horizontalProgressBar)
        centerProgressBar = findViewById(R.id.centerProgressBar)

        // Setup Notification Channel for Android Oreo+
        createNotificationChannel()

        // Request Push Notification permissions (Android 13+)
        requestNotificationPermission()

        // Configure WebView settings for full dynamic full-stack React operation
        setupWebView()

        // Load Application
        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }

        // Setup Pull-to-Refresh Gesture
        swipeRefreshLayout.setColorSchemeColors(ContextCompat.getColor(this, R.color.brand_accent))
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadsImagesAutomatically = true
        settings.geolocationEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.userAgentString = settings.userAgentString + " GTS_Android_Client_v1"

        // Persistent Session Cookies Persistence
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        }

        // Register custom JS bridge interface
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidInterface")

        // Intercept standard page triggers, links, and system actions
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                horizontalProgressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                horizontalProgressBar.visibility = View.GONE
                centerProgressBar.visibility = View.GONE
                swipeRefreshLayout.isRefreshing = false
                
                // Flush cookies to disk storage
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().flush()
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false // Load within WebView
                }
                
                // Keep external elements (telephone links, WhatsApp links) in external native intents
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    Log.e("WebView", "Failed to start intent: $url", e)
                }
                return true
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    Toast.makeText(this@MainActivity, "Network Offline Mode Alert. Retrying...", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Handle full media file selection dialogue (Camera / Gallery)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                horizontalProgressBar.progress = newProgress
            }

            // Auto-grant HTML5 Geolocation prompt
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }

            // Auto-grant HTML5 camera, microphone and video streaming permissions
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request?.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (fileCallback != null) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                }
                fileCallback = filePathCallback

                var takePictureIntent: Intent? = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                if (takePictureIntent?.resolveActivity(packageManager) != null) {
                    var photoFile: File? = null
                    try {
                        photoFile = createImageFile()
                        takePictureIntent.putExtra("PhotoPath", cameraPhotoPath)
                    } catch (ex: IOException) {
                        Log.e("WebView", "Unable to create Image File", ex)
                    }

                    if (photoFile != null) {
                        cameraPhotoPath = "file:" + photoFile.absolutePath
                        val photoURI: Uri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "com.gts.isp.management.fileprovider",
                            photoFile
                        )
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
                    } else {
                        takePictureIntent = null
                    }
                }

                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT)
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE)
                contentSelectionIntent.type = "image/*"

                val intentArray: Array<Intent> = takePictureIntent?.let { arrayOf(it) } ?: emptyArray()

                val chooserIntent = Intent(Intent.ACTION_CHOOSER)
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Photo to Upload")
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)

                try {
                    fileUploadStartLauncher.launch(chooserIntent)
                } catch (e: Exception) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                    Toast.makeText(this@MainActivity, "Photo Upload Cancelled", Toast.LENGTH_LONG).show()
                    return false
                }
                return true
            }
        }
    }

    private val fileUploadStartLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileCallback == null) return@registerForActivityResult

        var results: Array<Uri>? = null
        if (result.resultCode == RESULT_OK) {
            val dataString = result.data?.dataString
            if (dataString != null) {
                results = arrayOf(Uri.parse(dataString))
            } else if (cameraPhotoPath != null) {
                results = arrayOf(Uri.parse(cameraPhotoPath))
            }
        }
        
        fileCallback?.onReceiveValue(results)
        fileCallback = null
        cameraPhotoPath = null
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_" + timeStamp + "_"
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_CODE)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "GTS Ticket Alerts"
            val descriptionText = "Real-time updates of fiber cuts, node restarts, and chat messages."
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
                enableLights(true)
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    // JS Bridge class loaded directly into Web Console
    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun showNotification(title: String, message: String) {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setTicker(title)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            with(NotificationManagerCompat.from(context)) {
                val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                } else {
                    true
                }
                if (hasPermission) {
                    notify(System.currentTimeMillis().toInt(), builder.build())
                }
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            if (doubleBackToExitPressedOnce) {
                super.onBackPressed()
                return
            }
            this.doubleBackToExitPressedOnce = true
            Toast.makeText(this, "Press back again to close App", Toast.LENGTH_SHORT).show()
            Handler(Looper.getMainLooper()).postDelayed({
                doubleBackToExitPressedOnce = false
            }, 2000)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }
}
