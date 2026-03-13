import { useEffect } from "react";
import { deviceManager } from "../api/deviceManager";

export default function GoogleLoginButton() {

  useEffect(() => {
    /* global google */
    google.accounts.id.initialize({
      client_id: "58242080142-8jl5fdb92e3k4ti0eqtrgvdjq86ll74m.apps.googleusercontent.com",
      callback: handleGoogleResponse,
    });

    google.accounts.id.renderButton(
      document.getElementById("googleLoginBtn"),
      { theme: "outline", size: "large" }
    );
  }, []);

  const handleGoogleResponse = async (response) => {
    console.log("Google Credential:", response.credential);

    // Send the credential to backend
    const backendResponse = await deviceManager.loginWithGoogle(response.credential);

    if (backendResponse) {
      console.log("Login success!");
      // Dispatch custom event to notify other components of successful login
      window.dispatchEvent(new Event('userLoggedIn'));
    } else {
      console.log("Login failed.");
    }
  };

  return <div id="googleLoginBtn"></div>;
}
