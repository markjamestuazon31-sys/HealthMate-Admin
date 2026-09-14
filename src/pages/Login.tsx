import {
  ArrowForwardRounded, AssessmentOutlined, EmailOutlined, GroupsOutlined,
  HealthAndSafetyOutlined, LockOutlined, PlaceOutlined, SmartphoneOutlined,
  VisibilityOffOutlined, VisibilityOutlined,
} from "@mui/icons-material";
import { Alert, Button, CircularProgress, IconButton, InputAdornment, TextField } from "@mui/material";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import healthMateLogo from "../assets/healthmate-logo.png";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../firebase/auth";
import { friendlyAccessError, friendlyLoginError, loginDestination } from "../utils/loginPresentation";
import "../styles/login.css";

type Phase = "idle" | "submitting" | "verifying";
function LoginBrand({ mobile = false }: { mobile?: boolean }) {
  return <div className={`hm-login-brand${mobile ? " hm-login-brand-mobile" : ""}`}>
    <img src={healthMateLogo} alt="" width="56" height="56" />
    <div><strong>HealthMate</strong><span>Care. Connect. Protect.</span></div>
  </div>;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [takingLonger, setTakingLonger] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const mounted = useRef(true);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const alertBox = useRef<HTMLDivElement>(null);
  const { user, role, loading, error: accessError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authorized = Boolean(user && (role === "administrator" || role === "admin"));
  const endingRejectedSession = Boolean(user && accessError && !authorized);
  const busy = loading || phase !== "idle" || authorized || endingRejectedSession;
  const message = error || (phase === "idle" && !loading ? friendlyAccessError(accessError) : "");
  const actionLabel = endingRejectedSession ? "Closing session…" : phase === "submitting" ? "Signing in…" : phase === "verifying" || (loading && user)
    ? "Verifying access…" : loading ? "Checking session…" : authorized ? "Opening workspace…" : "Sign in";

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!loading && authorized) {
      const requested = (location.state as { from?: unknown } | null)?.from;
      navigate(loginDestination(requested), { replace: true });
    }
  }, [authorized, loading, location.state, navigate]);
  useEffect(() => {
    if (!loading && accessError) {
      attempt.current += 1;
      inFlight.current = false;
      setPhase("idle");
      setPassword("");
      setShowPassword(false);
    }
  }, [accessError, loading]);
  useEffect(() => {
    if (message) alertBox.current?.focus();
  }, [message]);
  useEffect(() => {
    setTakingLonger(false);
    if (!busy) return;
    const timer = window.setTimeout(() => setTakingLonger(true), 12000);
    return () => window.clearTimeout(timer);
  }, [busy]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || inFlight.current) return;
    const issues = {
      email: !email.trim() ? "Enter your email address." : emailInput.current?.validity.typeMismatch ? "Enter a valid email address." : "",
      password: !password ? "Enter your password." : "",
    };
    setFieldErrors(issues);
    setError("");
    if (issues.email || issues.password) {
      (issues.email ? emailInput : passwordInput).current?.focus();
      return;
    }
    inFlight.current = true;
    const attemptId = ++attempt.current;
    setPhase("submitting");
    try {
      await loginUser(email.trim(), password);
      if (mounted.current && attemptId === attempt.current && inFlight.current) setPhase("verifying");
      // AuthContext verifies the active administrator record before navigation.
    } catch (caught) {
      if (mounted.current && attemptId === attempt.current) {
        inFlight.current = false;
        setPhase("idle");
        setError(friendlyLoginError(caught));
      }
    }
  }
  function checkCapsLock(event: KeyboardEvent<HTMLDivElement>) {
    setCapsLock(event.getModifierState?.("CapsLock") === true);
  }

  return <main className="hm-login-page">
    <div className="hm-login-shell">
      <aside className="hm-login-hero" aria-label="About HealthMate">
        <LoginBrand />
        <div className="hm-login-hero-content">
          <p className="hm-login-eyebrow">COMMUNITY HEALTH ADMINISTRATION</p>
          <h2>Coordinate care.<br />Support your<br className="hm-login-title-break" /> community.</h2>
          <p className="hm-login-hero-description">One workspace for emergency response, community records and barangay programs.</p>
          <ul className="hm-login-features">
            <li><span><HealthAndSafetyOutlined /></span><div><strong>Emergency response</strong><p>Coordinate SOS alerts and rescue operations.</p></div></li>
            <li><span><GroupsOutlined /></span><div><strong>Community records</strong><p>Organize households and inhabitant profiles.</p></div></li>
            <li><span><AssessmentOutlined /></span><div><strong>Programs and reports</strong><p>Follow up activities and review outcomes.</p></div></li>
          </ul>
        </div>
        <div className="hm-login-location"><PlaceOutlined /><span>Barangay Bunuanan<span>City of Catbalogan</span></span></div>
      </aside>

      <section className="hm-login-form-panel" aria-labelledby="hm-login-title">
        <LoginBrand mobile />
        <div className="hm-login-form-content">
          <div className="hm-login-access-label"><span><LockOutlined /></span>Administrator portal</div>
          <header className="hm-login-form-heading"><h1 id="hm-login-title">Welcome back</h1><p>Sign in to your HealthMate workspace.</p></header>

          <form className="hm-login-form" onSubmit={handleLogin} noValidate aria-label="Administrator sign in" aria-busy={busy}>
            {message && <div ref={alertBox} tabIndex={-1} className="hm-login-alert-focus"><Alert severity="error">{message}</Alert></div>}
            <div className="hm-login-field"><label htmlFor="hm-login-email">Email address</label>
              <TextField id="hm-login-email" name="email" type="email" fullWidth required disabled={busy}
                inputRef={emailInput} autoComplete="username" placeholder="Enter your email address"
                value={email} error={Boolean(fieldErrors.email)} helperText={fieldErrors.email || undefined}
                inputProps={{ inputMode: "email", autoCapitalize: "none", spellCheck: false }}
                onChange={event => { setEmail(event.target.value); setFieldErrors(current => ({ ...current, email: "" })); setError(""); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> }} />
            </div>
            <div className="hm-login-field"><label htmlFor="hm-login-password">Password</label>
              <TextField id="hm-login-password" name="password" type={showPassword ? "text" : "password"} fullWidth required disabled={busy}
                inputRef={passwordInput} autoComplete="current-password" placeholder="Enter your password"
                value={password} error={Boolean(fieldErrors.password)} helperText={fieldErrors.password || undefined}
                onChange={event => { setPassword(event.target.value); setFieldErrors(current => ({ ...current, password: "" })); setError(""); }}
                onKeyDown={checkCapsLock} onKeyUp={checkCapsLock} onBlur={() => setCapsLock(false)}
                inputProps={{ "aria-describedby": [fieldErrors.password ? "hm-login-password-helper-text" : "", capsLock ? "hm-login-caps-lock" : ""].filter(Boolean).join(" ") || undefined }}
                InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton type="button" disabled={busy} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onMouseDown={event => event.preventDefault()} onClick={() => setShowPassword(value => !value)} edge="end">{showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}</IconButton></InputAdornment> }} />
              {capsLock && <p id="hm-login-caps-lock" className="hm-login-caps-lock" role="status">Caps Lock is on.</p>}
            </div>
            <Button fullWidth type="submit" variant="contained" disabled={busy} className="hm-login-submit" endIcon={busy ? undefined : <ArrowForwardRounded />}>
              {busy && <CircularProgress size={19} color="inherit" aria-hidden="true" />}<span>{actionLabel}</span>
            </Button>
            <span className="hm-login-sr-only" role="status" aria-live="polite">{busy ? actionLabel : ""}</span>
            {takingLonger && <div className="hm-login-waiting" role="status"><p>This is taking longer than usual. Check your connection, then reload the page if needed.</p><Button type="button" size="small" onClick={() => window.location.reload()}>Reload page</Button></div>}
          </form>

          <details className="hm-login-help"><summary>Need help signing in?</summary><p>Use the email assigned to your administrator account. For password or access assistance, contact your system administrator.</p></details>
          <div className="hm-login-mobile-note"><SmartphoneOutlined /><p>Residents and respondents use the HealthMate mobile apps.</p></div>
        </div>
        <footer className="hm-login-form-footer"><LockOutlined /><span>For authorized administrators only</span></footer>
      </section>
    </div>
    <p className="hm-login-page-footer">HealthMate Administration<span aria-hidden="true">•</span>Barangay Bunuanan, Catbalogan City</p>
  </main>;
}
