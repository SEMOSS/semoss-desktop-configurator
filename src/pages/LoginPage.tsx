// LoginPage.tsx - Username/password + SSO login screen.
//
// Wired directly to the SEMOSS SDK via useInsight():
//   - actions.login({ type: "native", username, password }) for username/password
//   - actions.login({ type: "oauth", provider })             for SSO
//
// Available SSO providers are read from system.config.availableProviders, which
// the SEMOSS backend populates based on its configuration. Each entry has
// { provider, name, isOauth } — we render a button per provider.
//
// This page is rendered by InitializedLayout when isAuthorized is false.

import { useInsight } from "@semoss/sdk/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export const LoginPage = () => {
	const { actions, system } = useInsight();

	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeProvider, setActiveProvider] = useState<string | null>(null);

	// When running in Electron, reset the spinner if the user closes the OAuth
	// popup without completing login.  Auth success is handled by OauthMessageRelay
	// in App.tsx, which forwards the popup's postMessage to the SDK so it can
	// resolve the login promise and flip isAuthorized without a page reload.
	useEffect(() => {
		if (!window.electron) return;
		return window.electron.onOauthCancelled(() => {
			setIsSubmitting(false);
			setActiveProvider(null);
		});
	}, []);

	const providers = system?.config?.availableProviders ?? [];
	// "native" is the username/password provider — handled by the form, not a button.
	const oauthProviders = providers.filter(
		(p) => p.isOauth && p.provider !== "native",
	);

	const handleNativeLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !password) return;

		setIsSubmitting(true);
		setActiveProvider("native");
		try {
			await actions.login({
				type: "native",
				username,
				password,
			});
			// On success, the SDK flips isAuthorized to true and InitializedLayout
			// will swap this page out for the authenticated routes.
		} catch (error) {
			toast.error(
				error instanceof Error && error.message
					? error.message
					: "Login failed. Check your credentials and try again.",
			);
		} finally {
			setIsSubmitting(false);
			setActiveProvider(null);
		}
	};

	const handleOauthLogin = async (provider: string) => {
		setIsSubmitting(true);
		setActiveProvider(provider);
		try {
			await actions.login({
				type: "oauth",
				provider,
			});
		} catch (error) {
			toast.error(
				error instanceof Error && error.message
					? error.message
					: `Login with ${provider} failed.`,
			);
		} finally {
			setIsSubmitting(false);
			setActiveProvider(null);
		}
	};

	return (
		<div className="flex items-center justify-center min-h-screen p-4 bg-background">
			<div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-sm">
				<div className="space-y-1 text-center">
					<h1 className="text-2xl font-semibold">Sign in</h1>
					<p className="text-sm text-muted-foreground">
						Sign in to continue to the application.
					</p>
				</div>

				<form className="space-y-4" onSubmit={handleNativeLogin}>
					<div className="space-y-2">
						<Label htmlFor="username">Username</Label>
						<Input
							id="username"
							type="text"
							autoComplete="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							disabled={isSubmitting}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={isSubmitting}
							required
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={
							isSubmitting || !username.trim() || !password
						}
					>
						{activeProvider === "native" ? (
							<>
								<Spinner className="size-4" />
								Signing in...
							</>
						) : (
							"Sign in"
						)}
					</Button>
				</form>

				{oauthProviders.length > 0 && (
					<>
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-card px-2 text-muted-foreground">
									Or continue with
								</span>
							</div>
						</div>

						<div className="space-y-2">
							{oauthProviders.map((p) => (
								<Button
									key={p.provider}
									type="button"
									variant="outline"
									className="w-full"
									disabled={isSubmitting}
									onClick={() => handleOauthLogin(p.provider)}
								>
									{activeProvider === p.provider ? (
										<>
											<Spinner className="size-4" />
											Redirecting...
										</>
									) : (
										p.name || p.provider
									)}
								</Button>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
};
