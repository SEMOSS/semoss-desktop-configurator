// InitializedLayout.tsx - Gate that blocks rendering until SEMOSS is ready.
//
// All routes are wrapped in this layout (see Router.tsx). It checks the SDK's
// initialization and auth state and shows one of:
//   - A loading spinner while SEMOSS connects
//   - An error page if initialization failed
//   - The LoginPage if the user is not yet authorized
//   - The actual page content (via <Outlet />) once ready and authorized
//
// The useInsight() hook provides { isInitialized, isAuthorized, error } from the
// InsightProvider. Once the user signs in successfully, isAuthorized flips to
// true and the gated routes render automatically.

import { useInsight } from "@semoss/sdk/react";
import { Outlet } from "react-router-dom";
import { LoadingScreen } from "@/components";
import { ErrorPage } from "../ErrorPage";
import { LoginPage } from "../LoginPage";

export const InitializedLayout = () => {
	const { isInitialized, isAuthorized, error } = useInsight();

	if (error) return <ErrorPage />;
	if (!isInitialized) return <LoadingScreen />;
	if (!isAuthorized) return <LoginPage />;

	return (
		<div className="flex flex-col h-screen">
			<div className="p-4 overflow-auto h-full">
				{/* Outlet renders whichever child route matched in Router.tsx */}
				<Outlet />
			</div>
		</div>
	);
};
