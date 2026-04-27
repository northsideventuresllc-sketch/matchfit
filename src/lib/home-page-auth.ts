/**
 * Session snapshot for the marketing home page (CTAs + header menu).
 * Role-specific menus: client-only vs trainer-only vs both (see `HomeLoginMenu`).
 */
export type HomePageAuth = {
  clientLoggedIn: boolean;
  trainerLoggedIn: boolean;
};

export const CLIENT_SIGN_IN_PATH = "/client";
export const TRAINER_SIGN_IN_PATH = "/trainer/dashboard/login";
export const CLIENT_SIGN_UP_PATH = "/client/sign-up";
export const TRAINER_SIGN_UP_PATH = "/trainer/signup";
export const CLIENT_DASHBOARD_PATH = "/client/dashboard";
export const TRAINER_DASHBOARD_PATH = "/trainer/dashboard";
