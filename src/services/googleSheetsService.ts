initiateAuth: async (): Promise<GoogleTokens> => {
    try {
      console.log("Initiating Google Sheets connection using Pure Firebase Client Auth...");
      
      if (!navigator.onLine) {
        throw new Error("You are currently offline. Please connect to the internet first.");
      }

      // Configure provider with custom prompt to always ensure consent is requested
      provider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });

      // Try the smooth native Firebase Sign-In popup using the user's authorized redirect handler
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential || !credential.accessToken) {
        throw new Error("Failed to retrieve Google Access Token from Firebase credentials.");
      }
      
      // Calculate token expiry (typically 3590 seconds from now)
      const expiry_date = Date.now() + 3590 * 1000;
      
      const tokens: GoogleTokens = {
        access_token: credential.accessToken,
        token_type: "Bearer",
        expiry_date: expiry_date,
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
      };
      
      // Handle optional refresh token from result context if present
      if ((result as any)._tokenResponse?.refreshToken) {
        tokens.refresh_token = (result as any)._tokenResponse.refreshToken;
      }
      
      googleSheetsService.saveTokens(tokens);
      console.log("Firebase Google Sheets credentials retrieved successfully!");
      return tokens;
    } catch (fbAuthError: any) {
      console.error("Firebase Auth Google Popup failed directly:", fbAuthError);
      
      // Explicitly friendly error checking for unauthorized domain settings
      if (fbAuthError.code === 'auth/unauthorized-domain') {
        throw new Error("This domain is not authorized in Firebase Console yet. Please ensure you saved your Hugging Face space URL under Firebase Auth Settings.");
      }
      
      throw new Error(fbAuthError.message || "Authentication failed. Popup was blocked or closed before completion.");
    }
  },
