import { z } from 'zod';

/**
 * Step one of signing in: the address alone. What the backend answers for it
 * decides whether step two is the password field or the sign-up form, so
 * nothing else is asked here.
 */
export const identificationSchema = z.object({
  email: z
    .string()
    .min(1, 'Enter your email.')
    .email('Enter a valid email, like name@example.com.'),
});

/** Step two for an address that already has an account. */
export const passwordSchema = z.object({
  password: z
    .string()
    .min(1, 'Enter your password.')
    .min(6, 'Use at least 6 characters.'),
});

/**
 * The forgotten-password entry form. Same rule as identification — an address
 * is an address — but a schema of its own, because the two screens ask for it
 * for different reasons and their copy differs.
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Enter your email.')
    .email('Enter a valid email, like name@example.com.'),
});

/** The last step of a reset: the new password, typed twice. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Enter your password.')
      .min(6, 'Use at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match. Re-enter it.",
    path: ['confirmPassword'],
  });

/**
 * The details a social login cannot supply on its own. Google gives us a name
 * (sometimes only a display name), never a phone number — and the backend
 * needs one to reach the customer about a delivery — so the screen asks for
 * all three and pre-fills what the token had.
 *
 * The field rules are deliberately identical to `signupSchema`'s: the same
 * customer record comes out of both, so it must not be possible to get a
 * weaker one by arriving through Google.
 */
export const completeProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Enter your first name.')
    .min(2, 'Use at least 2 letters.'),
  lastName: z
    .string()
    .min(1, 'Enter your last name.')
    .min(2, 'Use at least 2 letters.'),
  phoneNumber: z
    .string()
    .min(1, 'Enter your phone number.')
    .refine((v) => /^\d{8}$/.test(v.replace(/\s/g, '')), 'Enter an 8-digit Tunisian number.'),
});

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'Enter your first name.')
      .min(2, 'Use at least 2 letters.'),
    lastName: z
      .string()
      .min(1, 'Enter your last name.')
      .min(2, 'Use at least 2 letters.'),
    phoneNumber: z
      .string()
      .min(1, 'Enter your phone number.')
      .refine((v) => /^\d{8}$/.test(v.replace(/\s/g, '')), 'Enter an 8-digit Tunisian number.'),
    password: z
      .string()
      .min(1, 'Enter your password.')
      .min(6, 'Use at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match. Re-enter it.",
    path: ['confirmPassword'],
  });

export const accountSettingsSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Enter your first name.')
    .min(2, 'Use at least 2 letters.'),
  lastName: z
    .string()
    .min(1, 'Enter your last name.')
    .min(2, 'Use at least 2 letters.'),
  email: z
    .string()
    .min(1, 'Enter your email.')
    .email('Enter a valid email, like name@example.com.'),
  phoneNumber: z
    .string()
    .regex(/^[+0-9\s]*$/, 'Enter an 8-digit Tunisian number.')
    .optional()
    .or(z.literal('')),
});

export type IdentificationFormData = z.infer<typeof identificationSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type NewPasswordFormData = z.infer<typeof newPasswordSchema>;
export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type AccountSettingsFormData = z.infer<typeof accountSettingsSchema>;
