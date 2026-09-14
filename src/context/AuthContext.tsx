import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { resolveAdminRole } from "../policies/accountPolicy";
import { registerAdminDispatchPresence } from "../services/adminDispatchService";
import { registerAdministrationChannel } from "../services/adminResponderMessagingService";
import { listenAdminProfile } from "../services/adminProfileService";
import type { AdminProfile, AdminRole } from "../types";

interface AuthContextType {
  user: FirebaseUser | null;
  role: AdminRole | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  error: string | null;
  dispatchWarning: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  adminProfile: null,
  loading: true,
  error: null,
  dispatchWarning: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchWarning, setDispatchWarning] = useState<string | null>(null);
  const profileUnsubscribeRef = useRef<null | (() => void)>(null);
  const dispatchCleanupRef = useRef<null | (() => void | Promise<void>)>(null);
  const accessErrorAfterSignOutRef = useRef<string | null>(null);

  useEffect(() => {
    const stopProfileListener = () => {
      profileUnsubscribeRef.current?.();
      profileUnsubscribeRef.current = null;
    };
    const stopDispatchPresence = () => {
      if (dispatchCleanupRef.current) void dispatchCleanupRef.current();
      dispatchCleanupRef.current = null;
    };

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const retainedAccessError = currentUser
        ? null
        : accessErrorAfterSignOutRef.current;
      if (!currentUser) accessErrorAfterSignOutRef.current = null;

      stopProfileListener();
      stopDispatchPresence();
      setUser(currentUser);
      setRole(null);
      setAdminProfile(null);
      setError(retainedAccessError);
      setDispatchWarning(null);
      setLoading(true);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      profileUnsubscribeRef.current = listenAdminProfile(
        currentUser.uid,
        async (profile) => {
          const resolvedRole = resolveAdminRole(profile, currentUser.email);
          if (!profile || !resolvedRole) {
            const accessMessage =
              "The password was accepted, but no active administrator record was found for this Firebase Authentication UID. Verify that /admins/<Authentication UID> uses the same UID and contains role 'administrator' and status 'active'.";
            accessErrorAfterSignOutRef.current = accessMessage;
            setError(accessMessage);
            setRole(null);
            setAdminProfile(null);
            setLoading(false);
            stopDispatchPresence();
            stopProfileListener();
            await signOut(auth).catch((logoutError) => {
              console.error("Unable to sign out an unauthorized portal account", logoutError);
            });
            return;
          }

          const verifiedProfile: AdminProfile = {
            ...profile,
            email: profile.email.trim() || currentUser.email?.trim() || "",
            role: resolvedRole,
          };
          setUser(currentUser);
          setRole(resolvedRole);
          setAdminProfile(verifiedProfile);
          setError(null);
          setLoading(false);

          void registerAdministrationChannel(verifiedProfile.fullName || "HealthMate Administration")
            .catch((communicationError) => {
              console.error("Unable to register this administrator for responder messaging", communicationError);
            });

          stopDispatchPresence();
          try {
            dispatchCleanupRef.current = registerAdminDispatchPresence(
              {
                uid: currentUser.uid,
                email: verifiedProfile.email,
                fullName: verifiedProfile.fullName,
                role: resolvedRole,
              },
              () => setDispatchWarning(
                "Signed in, but SOS dispatch presence could not be registered. Review the emergencyDispatchRecipients database rules.",
              ),
            );
            setDispatchWarning(null);
          } catch (presenceError) {
            console.error("Unable to register this administrator for SOS dispatch", presenceError);
            setDispatchWarning(
              "Signed in, but SOS dispatch presence could not be registered. Review the emergencyDispatchRecipients database rules.",
            );
          }
        },
        async (profileError) => {
          console.error("Unable to verify the administrator profile", profileError);
          const accessMessage =
            "The password was accepted, but the portal could not read /admins/<Authentication UID>. Apply the included Realtime Database login-read rule and confirm that this website uses the same Firebase project as the administrator account.";
          accessErrorAfterSignOutRef.current = accessMessage;
          setError(accessMessage);
          setRole(null);
          setAdminProfile(null);
          setLoading(false);
          stopDispatchPresence();
          stopProfileListener();
          await signOut(auth).catch(() => undefined);
        },
      );
    });

    return () => {
      authUnsubscribe();
      stopProfileListener();
      stopDispatchPresence();
    };
  }, []);

  const value = useMemo(
    () => ({ user, role, adminProfile, loading, error, dispatchWarning }),
    [user, role, adminProfile, loading, error, dispatchWarning],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
