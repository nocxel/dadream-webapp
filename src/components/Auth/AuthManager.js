import { supabase } from '../../../supabaseClient.js';
import './Auth.css';

export default class AuthManager {
    constructor(store) {
        this.store = store;
        this.injectHtml();

        this.loginScreen = document.getElementById('loginScreen');
        this.appContent = document.getElementById('appContent');
        this.loginForm = document.getElementById('loginForm');
        this.loginError = document.getElementById('loginError');
        this.btnLogout = document.getElementById('btnLogout');

        // Sign-up specific elements
        this.isSignupMode = false;
        this.signupNameInputGroup = document.getElementById('signupNameGroup');
        this.authTitle = document.getElementById('authTitle');
        this.authBtn = document.getElementById('authBtn');
        this.toggleAuthModeBtn = document.getElementById('toggleAuthMode');

        this.init();
    }

    injectHtml() {
        if (document.getElementById('loginScreen')) return;

        const template = `
            <div id="loginScreen" class="login-screen-overlay" style="display: none">
                <div class="glass-panel login-panel">
                    <h1 class="login-title">
                        <span class="login-brand-highlight">DaDream</span> CRM
                    </h1>
                    <p id="authTitle" class="login-subtitle">영업 사원 전용 로그인</p>

                    <form id="loginForm">
                        <!-- Name Field (Signup Only) -->
                        <div id="signupNameGroup" class="input-group hidden" style="margin-bottom: 20px;">
                            <div class="input-with-icon premium">
                                <i class="fa-solid fa-user input-icon"></i>
                                <input type="text" id="signupName" placeholder="이름 (실명)"
                                    class="glass-input premium-input login-input-bg">
                            </div>
                        </div>

                        <div class="input-group" style="margin-bottom: 20px;">
                            <div class="input-with-icon premium">
                                <i class="fa-solid fa-envelope input-icon"></i>
                                <input type="email" id="loginEmail" placeholder="이메일 주소"
                                    class="glass-input premium-input login-input-bg" required>
                            </div>
                        </div>

                        <div class="input-group" style="margin-bottom: 30px;">
                            <div class="input-with-icon premium">
                                <i class="fa-solid fa-lock input-icon"></i>
                                <input type="password" id="loginPassword" placeholder="비밀번호"
                                    class="glass-input premium-input login-input-bg" required>
                            </div>
                        </div>

                        <button type="submit" id="authBtn" class="premium-btn primary login-btn">
                            로그인 하기
                        </button>
                    </form>

                    <p id="loginError" class="login-error-msg hidden"></p>
                    
                    <div style="margin-top: 15px; font-size: 14px; color: #666;">
                        <span id="authModeText">처음이신가요?</span>
                        <a href="#" id="toggleAuthMode" style="color: var(--primary-color); font-weight: bold; text-decoration: none; margin-left: 5px;">
                            회원가입
                        </a>
                    </div>
                </div>
                <p class="login-footer">
                    &copy; 2026 Dadream System
                </p>
            </div>
        `;

        const range = document.createRange();
        const fragment = range.createContextualFragment(template);
        document.body.appendChild(fragment);
    }

    init() {
        // REMOVED: this.checkSession(); 
        // We rely entirely on onAuthStateChange(INITIAL_SESSION) to handle startup.
        // This prevents the "Login Screen -> Map" flicker caused by premature logout checks.

        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleAuth(e));
        }

        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', () => this.handleLogout());
        }

        if (this.toggleAuthModeBtn) {
            this.toggleAuthModeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthMode();
            });
        }

        // Initialize processing flag
        this.isProcessingLogin = false;

        // Unified Auth Listener
        supabase.auth.onAuthStateChange(async (event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                await this._restoreSession(session);
            } else if (event === 'SIGNED_OUT') {
                this.onLogoutSuccess();
            } else if (event === 'INITIAL_SESSION' && !session) {
                // No session found on startup -> Show Login Screen (Logic handled in onLogoutSuccess)
                this.onLogoutSuccess();
            }
        });
    }

    // Consolidated Session Restoration Logic
    async _restoreSession(session) {
        if (this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        const email = session.user.email;
        if (!email) {
            console.error("Session missing email");
            this.onLogoutSuccess();
            return;
        }

        // 1. FAST PATH: Optimistic UI (Cache)
        const cachedRep = this._loadCachedRep();
        if (cachedRep && cachedRep.email === email) {
            console.log("⚡ [Auth] Fast Path: Restoring from cache");
            this.onLoginSuccess({ ...session.user, ...cachedRep }, false);

            // Fire-and-forget background check
            this._verifySessionBackground(session, cachedRep);
            this.isProcessingLogin = false; // Release lock logic
            return;
        }

        // 2. SLOW PATH: No cache, must wait for DB
        try {
            console.log("⏳ [Auth] Slow Path: Verifying with DB...");
            const repRow = await this.store.checkWhitelist(email);

            if (!repRow) {
                console.warn("❌ Profile not found (Invalid User). Logging out.");
                this._clearCachedRep();
                await supabase.auth.signOut();
                return;
            }

            this._saveCachedRep(repRow);
            const fullUser = { ...session.user, ...repRow };
            await this.onLoginSuccess(fullUser);

        } catch (err) {
            console.error("⚠️ Login Failed:", err.message);
            alert(`로그인 실패: ${err.message}`);
            this.onLogoutSuccess();
        } finally {
            this.isProcessingLogin = false;
        }
    }

    async _verifySessionBackground(session, cachedRep) {
        try {
            // Race against the store call
            const dbPromise = this.store.checkWhitelist(session.user.email);
            // 10s timeout for background check
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("BG_DB_TIMEOUT")), 10000)
            );

            const repRow = await Promise.race([dbPromise, timeoutPromise]);

            if (!repRow) {
                console.warn("❌ [Background] Profile invalid or deleted. Forcing logout.");
                alert("사용자 권한이 변경되어 로그아웃됩니다.");
                this._clearCachedRep();
                await supabase.auth.signOut();
                // window.location.reload(); // Optional
            } else {
                console.log("✅ [Background] Session verified. Updating cache.");
                // Update cache with latest data
                this._saveCachedRep(repRow);
                // Optional: Update store user if data changed significantly? 
                // Mostly cache is for next reload using fresh data.
            }
        } catch (err) {
            console.warn(`⚠️ [Background] Verification warning: ${err.message}`);
            // Do NOT logout on timeout/network error. optimizing for offline usage.
        }
    }

    // Cache Helpers
    _loadCachedRep() {
        try {
            const data = localStorage.getItem('dadream_rep_profile');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    _saveCachedRep(rep) {
        try {
            localStorage.setItem('dadream_rep_profile', JSON.stringify(rep));
        } catch (e) {
            console.warn("Failed to save cache", e);
        }
    }

    _clearCachedRep() {
        localStorage.removeItem('dadream_rep_profile');
    }

    toggleAuthMode() {
        this.isSignupMode = !this.isSignupMode;

        if (this.signupNameInputGroup) {
            if (this.isSignupMode) {
                this.signupNameInputGroup.classList.remove('hidden');
                document.getElementById('signupName').required = true;
                this.authTitle.textContent = "사원 회원가입";
                this.authBtn.textContent = "가입 및 로그인";
                document.getElementById('authModeText').textContent = "이미 계정이 있으신가요?";
                this.toggleAuthModeBtn.textContent = "로그인";
                this.loginError.classList.add('hidden');
            } else {
                this.signupNameInputGroup.classList.add('hidden');
                document.getElementById('signupName').required = false;
                this.authTitle.textContent = "영업 사원 전용 로그인";
                this.authBtn.textContent = "로그인 하기";
                document.getElementById('authModeText').textContent = "처음이신가요?";
                this.toggleAuthModeBtn.textContent = "회원가입";
                this.loginError.classList.add('hidden');
            }
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (this.loginError) {
            this.loginError.classList.add('hidden');
            this.loginError.textContent = '';
        }

        if (this.isSignupMode) {
            const name = document.getElementById('signupName').value.trim();
            await this.handleSignup(email, password, name);
        } else {
            await this.handleLogin(email, password);
        }
    }

    async handleSignup(email, password, name) {
        try {
            // 1. Whitelist Check
            const rep = await this.store.checkWhitelist(email);

            if (!rep) {
                throw new Error("승인된 사원이 아닙니다. 관리자에게 문의하세요.");
            }

            if (rep.auth_id) {
                throw new Error("이미 가입된 계정입니다. 로그인해주세요.");
            }

            // 2. Supabase Sign Up
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name }
                }
            });

            if (error) {
                console.error("Supabase signUp error:", error);
                if (error.message && error.message.includes("already registered")) {
                    throw new Error("이미 사용 중인 이메일입니다. 로그인해주세요.");
                }
                throw error;
            }

            if (!data.user) throw new Error("가입 처리 중 문제가 발생했습니다.");

            // 3. Link User to Rep
            await this.store.linkUserToRep(email, data.user.id);

            // 4. Update Name if provided
            if (name) {
                await supabase
                    .from('reps')
                    .update({ name: name.trim() })
                    .eq('email', email);
            }

            // Success (Auto-login handled by onAuthStateChange)

        } catch (error) {
            this.showError(error.message);
            // Hint for email typo
            if (error.message.includes("승인된 사원이 아닙니다")) {
                this.showError(error.message + " (이메일 주소를 확인해주세요.)");
            }
        }
    }

    async handleLogin(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                this.showError('로그인 실패: ' + error.message);
                return;
            }

            // Explicitly handle success to ensure UI updates immediately
            // REMOVED: Redundant logic. onAuthStateChange will handle this.
            console.log("✅ Login successful. Waiting for AuthStateChange...");

            // Optional: You could set a 'loading' state here if needed
            // But _restoreSession handles UI locking via isProcessingLogin
        } catch (fatalError) {
            alert("로그인 처리 중보 오류가 발생했습니다: " + fatalError.message);
            console.error(fatalError);
        }
    }

    showError(msg) {
        if (this.loginError) {
            this.loginError.textContent = msg;
            this.loginError.classList.remove('hidden');
        } else {
            alert(msg);
        }
    }

    async handleLogout() {
        const { error } = await supabase.auth.signOut();
        if (error) alert('로그아웃 실패');
    }

    async checkSession() {
        // Just trigger getSession() to ensure token is valid
        // The actual logic is handled by onAuthStateChange(INITIAL_SESSION)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error("Session Check Error:", error);
            // If error here, onAuthStateChange might not fire correctly, so force logout check
            this.onLogoutSuccess();
            return;
        }

        if (!session) {
            this.onLogoutSuccess();
        } else {
            console.log("💾 Session found. Waiting for AuthStateChange...");
        }
    }

    onLoginSuccess(user) {
        console.log('Logged in as:', user.email);

        // Re-query elements to ensure we have the correct reference
        const loginScreen = document.getElementById('loginScreen');
        const appContent = document.getElementById('appContent');

        if (!loginScreen || !appContent) {
            alert("Critical Error: UI Elements not found!\nLoginScreen: " + !!loginScreen + "\nAppContent: " + !!appContent);
        }

        if (loginScreen) {
            // Force hide using both class and inline style
            loginScreen.classList.add('hidden');
            loginScreen.style.display = 'none';
        }
        if (appContent) {
            // Force show
            appContent.classList.remove('hidden');
            appContent.style.display = 'block';
        }

        if (this.store) {
            this.store.setCurrentUser(user);
        }
        window.dispatchEvent(new Event('resize'));
    }

    onLogoutSuccess() {
        console.log('Logged out');
        this._clearCachedRep(); // Clear local cache

        // Restore UI Visibility (Clear inline styles from strong hide)
        if (this.appContent) {
            this.appContent.classList.add('hidden');
            this.appContent.style.display = 'none'; // Ensure hidden
        }

        if (this.loginScreen) {
            this.loginScreen.classList.remove('hidden');
            this.loginScreen.style.display = ''; // Reset to CSS default (flex/block)
        }

        // Reset to Login Mode
        if (this.isSignupMode) this.toggleAuthMode();

        if (this.store) {
            this.store.setCurrentUser(null);
        }
    }
}
