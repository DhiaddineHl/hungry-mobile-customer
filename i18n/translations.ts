/**
 * UI strings, keyed by screen. English is the reference dictionary: its keys
 * are the type every other language must satisfy, so a string missing from
 * French is a compile error, not an English fallback discovered on a device.
 *
 * `{{name}}` placeholders are filled by `translate()` in `./index.ts`.
 *
 * Coverage: the profile screen, everything reachable from it, and the tab bar.
 * The rest of the app is still English-only; migrate a screen by moving its
 * literals here and reading them through `useTranslation()`.
 */

export const en = {
  // Tab bar
  'tabs.home': 'Home',
  'tabs.favorites': 'Favorites',
  'tabs.cart': 'Cart',
  'tabs.profile': 'Profile',

  // Shared
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.back': 'Back',
  'common.openSettings': 'Open settings',
  'common.viewOnline': 'View online',
  'common.lastUpdated': 'Last updated: {{date}}',
  'common.optional': 'optional',

  // Profile
  'profile.title': 'Profile',
  'profile.defaultName': 'Hungry user',
  'profile.section.account': 'Account',
  'profile.accountManagement': 'Account management',
  'profile.section.preferences': 'Preferences',
  'profile.language': 'Language',
  'profile.notifications': 'Order notifications',
  'profile.notifications.hint':
    'Get notified when your order is confirmed, picked up and delivered.',
  'profile.notifications.blocked':
    'Turned off in your phone settings. Tap to allow notifications for Hungry.',
  'profile.notifications.blockedTitle': 'Notifications are blocked',
  'profile.notifications.blockedBody':
    'Hungry is not allowed to send notifications on this device. Allow them in your phone settings to receive order updates.',
  'profile.section.helpLegal': 'Help & legal',
  'profile.help': 'Help & support',
  'profile.report': 'Report a problem',
  'profile.terms': 'Terms of use',
  'profile.privacy': 'Privacy policy',
  'profile.section.session': 'Session',
  'profile.logout': 'Log out',
  'profile.logout.confirmTitle': 'Log out',
  'profile.logout.confirmBody': 'Are you sure you want to log out of your account?',
  'profile.section.danger': 'Danger zone',
  'profile.deleteAccount': 'Delete account',
  'profile.deleteAccount.hint': 'Permanently removes your account and personal data.',
  'profile.version': 'Hungry v{{version}}',

  // Help & support
  'help.title': 'Help & support',
  'help.intro':
    'Something wrong with an order, or a question about the app? Here is how to reach us.',
  'help.contact.title': 'Contact us',
  'help.contact.email': 'Email support',
  'help.contact.emailHint': 'We usually reply within one business day.',
  'help.contact.report': 'Report a problem',
  'help.contact.reportHint': 'Tell us about an order, a delivery or a bug.',
  'help.faq.title': 'Frequently asked questions',
  'help.faq.q1': 'Where is my order?',
  'help.faq.a1':
    'Open the Orders screen to follow your order from confirmation to delivery. Once a driver is assigned you can see their progress live. If nothing has moved for a long time, report a problem and include the order number.',
  'help.faq.q2': 'Can I cancel an order?',
  'help.faq.a2':
    'An order can be cancelled from its details screen while the restaurant has not confirmed it yet. After confirmation the restaurant starts preparing it, so contact support instead.',
  'help.faq.q3': 'How do I change my delivery address?',
  'help.faq.a3':
    'Tap the address at the top of the Home screen to switch between saved addresses or add a new one. At checkout you can also drop a pin for a one-off address.',
  'help.faq.q4': 'How do I update my name, email or phone number?',
  'help.faq.a4':
    'Go to Profile → Account management. Changes to your email also update the address you sign in with.',
  'help.faq.q5': 'How do I delete my account?',
  'help.faq.a5':
    'Go to Profile → Delete account. Your account and personal data are removed permanently; see the Privacy policy for what we are required to keep.',
  'help.mailError': 'Could not open your email app. You can write to {{email}}.',
  'help.emailSubject': '[Hungry] Support request',

  // Report a problem
  'report.title': 'Report a problem',
  'report.intro':
    'Describe what happened and we will look into it. Reports about a specific order are handled faster when the order number is included.',
  'report.category': 'What is it about?',
  'report.category.order': 'An order',
  'report.category.delivery': 'A delivery or driver',
  'report.category.restaurant': 'A restaurant or its menu',
  'report.category.payment': 'Payment or a charge',
  'report.category.content': 'Inappropriate or offensive content',
  'report.category.app': 'A bug in the app',
  'report.category.account': 'My account or privacy',
  'report.category.other': 'Something else',
  'report.orderRef': 'Order number',
  'report.orderRef.placeholder': 'e.g. ORD-2026-00123',
  'report.description': 'Description',
  'report.description.placeholder':
    'What happened, when, and what you expected instead…',
  'report.description.tooShort': 'Please give a bit more detail (at least 20 characters).',
  'report.submit': 'Send report',
  'report.privacyNote':
    'Your report is sent by email together with your account email so we can follow up. Do not include card numbers or passwords.',
  'report.emailSubject': '[Hungry] Report: {{category}}',
  'report.email.category': 'Category',
  'report.email.order': 'Order',
  'report.email.account': 'Account',
  'report.email.description': 'Description',
  'report.email.app': 'App',
  'report.mailError': 'Could not open your email app. You can send your report to {{email}}.',

  // Delete account
  'delete.title': 'Delete account',
  'delete.warning': 'This is permanent. Once deleted, your account cannot be recovered.',
  'delete.removed.title': 'What will be deleted',
  'delete.removed.profile': 'Your profile: name, email address and phone number',
  'delete.removed.addresses': 'Your saved delivery addresses',
  'delete.removed.login': 'Your login, including any Google sign-in link',
  'delete.removed.devices': 'This device’s notification registration',
  'delete.removed.local': 'Your favorites, cart and notification inbox on this phone',
  'delete.kept.title': 'What we keep',
  'delete.kept.body':
    'Records of completed orders and payments are kept, without your name or contact details, for as long as tax and accounting law requires. See the Privacy policy.',
  'delete.acknowledge': 'I understand that my account and data will be permanently deleted.',
  'delete.typeToConfirm': 'Type {{word}} to confirm',
  'delete.word': 'DELETE',
  'delete.submit': 'Delete my account',
  'delete.confirmTitle': 'Delete your account?',
  'delete.confirmBody': 'Your account and personal data will be removed permanently. This cannot be undone.',
  'delete.confirmAction': 'Delete',
  'delete.success.title': 'Account deleted',
  'delete.success.body': 'Your account has been removed. We are sorry to see you go.',
  'delete.error': 'We could not delete your account. Check your connection and try again, or contact {{email}}.',
  'delete.alt': 'You can also ask us to delete your account by writing to {{email}}.',
} as const;

export type TranslationKey = keyof typeof en;

export const fr: Record<TranslationKey, string> = {
  // Tab bar
  'tabs.home': 'Accueil',
  'tabs.favorites': 'Favoris',
  'tabs.cart': 'Panier',
  'tabs.profile': 'Profil',

  // Shared
  'common.cancel': 'Annuler',
  'common.ok': 'OK',
  'common.back': 'Retour',
  'common.openSettings': 'Ouvrir les réglages',
  'common.viewOnline': 'Consulter en ligne',
  'common.lastUpdated': 'Dernière mise à jour : {{date}}',
  'common.optional': 'facultatif',

  // Profile
  'profile.title': 'Profil',
  'profile.defaultName': 'Utilisateur Hungry',
  'profile.section.account': 'Compte',
  'profile.accountManagement': 'Gestion du compte',
  'profile.section.preferences': 'Préférences',
  'profile.language': 'Langue',
  'profile.notifications': 'Notifications de commande',
  'profile.notifications.hint':
    'Soyez prévenu quand votre commande est confirmée, récupérée et livrée.',
  'profile.notifications.blocked':
    'Désactivées dans les réglages du téléphone. Touchez pour autoriser les notifications de Hungry.',
  'profile.notifications.blockedTitle': 'Notifications bloquées',
  'profile.notifications.blockedBody':
    'Hungry n’est pas autorisé à envoyer des notifications sur cet appareil. Autorisez-les dans les réglages du téléphone pour recevoir le suivi de vos commandes.',
  'profile.section.helpLegal': 'Aide et informations légales',
  'profile.help': 'Aide et support',
  'profile.report': 'Signalements',
  'profile.terms': 'Conditions d’utilisation',
  'profile.privacy': 'Politique de confidentialité',
  'profile.section.session': 'Session',
  'profile.logout': 'Se déconnecter',
  'profile.logout.confirmTitle': 'Déconnexion',
  'profile.logout.confirmBody': 'Voulez-vous vraiment vous déconnecter de votre compte ?',
  'profile.section.danger': 'Zone de danger',
  'profile.deleteAccount': 'Supprimer le compte',
  'profile.deleteAccount.hint': 'Supprime définitivement votre compte et vos données personnelles.',
  'profile.version': 'Hungry v{{version}}',

  // Help & support
  'help.title': 'Aide et support',
  'help.intro':
    'Un souci avec une commande ou une question sur l’application ? Voici comment nous joindre.',
  'help.contact.title': 'Nous contacter',
  'help.contact.email': 'Écrire au support',
  'help.contact.emailHint': 'Nous répondons généralement sous un jour ouvré.',
  'help.contact.report': 'Signaler un problème',
  'help.contact.reportHint': 'Une commande, une livraison ou un bug : dites-nous tout.',
  'help.faq.title': 'Questions fréquentes',
  'help.faq.q1': 'Où est ma commande ?',
  'help.faq.a1':
    'Ouvrez l’écran Commandes pour suivre votre commande de la confirmation à la livraison. Dès qu’un livreur est affecté, vous voyez sa progression en direct. Si rien ne bouge depuis longtemps, faites un signalement en indiquant le numéro de commande.',
  'help.faq.q2': 'Puis-je annuler une commande ?',
  'help.faq.a2':
    'Une commande peut être annulée depuis son écran de détails tant que le restaurant ne l’a pas confirmée. Après confirmation, le restaurant commence la préparation : contactez plutôt le support.',
  'help.faq.q3': 'Comment changer mon adresse de livraison ?',
  'help.faq.a3':
    'Touchez l’adresse en haut de l’écran d’accueil pour passer d’une adresse enregistrée à une autre ou en ajouter une. Au moment de commander, vous pouvez aussi placer un repère pour une adresse ponctuelle.',
  'help.faq.q4': 'Comment modifier mon nom, mon e-mail ou mon téléphone ?',
  'help.faq.a4':
    'Allez dans Profil → Gestion du compte. Modifier votre e-mail change aussi l’adresse avec laquelle vous vous connectez.',
  'help.faq.q5': 'Comment supprimer mon compte ?',
  'help.faq.a5':
    'Allez dans Profil → Supprimer le compte. Votre compte et vos données personnelles sont supprimés définitivement ; la Politique de confidentialité précise ce que nous devons conserver.',
  'help.mailError': 'Impossible d’ouvrir votre application e-mail. Vous pouvez écrire à {{email}}.',
  'help.emailSubject': '[Hungry] Demande d’assistance',

  // Report a problem
  'report.title': 'Signaler un problème',
  'report.intro':
    'Décrivez ce qui s’est passé et nous nous en occupons. Les signalements liés à une commande sont traités plus vite avec le numéro de commande.',
  'report.category': 'De quoi s’agit-il ?',
  'report.category.order': 'Une commande',
  'report.category.delivery': 'Une livraison ou un livreur',
  'report.category.restaurant': 'Un restaurant ou son menu',
  'report.category.payment': 'Un paiement ou un prélèvement',
  'report.category.content': 'Contenu inapproprié ou offensant',
  'report.category.app': 'Un bug dans l’application',
  'report.category.account': 'Mon compte ou ma vie privée',
  'report.category.other': 'Autre chose',
  'report.orderRef': 'Numéro de commande',
  'report.orderRef.placeholder': 'ex. ORD-2026-00123',
  'report.description': 'Description',
  'report.description.placeholder':
    'Ce qui s’est passé, quand, et ce que vous attendiez…',
  'report.description.tooShort': 'Donnez un peu plus de détails (au moins 20 caractères).',
  'report.submit': 'Envoyer le signalement',
  'report.privacyNote':
    'Votre signalement est envoyé par e-mail avec l’adresse de votre compte pour que nous puissions vous répondre. N’y mettez ni numéro de carte ni mot de passe.',
  'report.emailSubject': '[Hungry] Signalement : {{category}}',
  'report.email.category': 'Catégorie',
  'report.email.order': 'Commande',
  'report.email.account': 'Compte',
  'report.email.description': 'Description',
  'report.email.app': 'Application',
  'report.mailError': 'Impossible d’ouvrir votre application e-mail. Vous pouvez envoyer votre signalement à {{email}}.',

  // Delete account
  'delete.title': 'Supprimer le compte',
  'delete.warning': 'Cette action est définitive. Un compte supprimé ne peut pas être récupéré.',
  'delete.removed.title': 'Ce qui sera supprimé',
  'delete.removed.profile': 'Votre profil : nom, adresse e-mail et numéro de téléphone',
  'delete.removed.addresses': 'Vos adresses de livraison enregistrées',
  'delete.removed.login': 'Votre identifiant de connexion, y compris la liaison Google',
  'delete.removed.devices': 'L’enregistrement de cet appareil pour les notifications',
  'delete.removed.local': 'Vos favoris, votre panier et vos notifications sur ce téléphone',
  'delete.kept.title': 'Ce que nous conservons',
  'delete.kept.body':
    'Les enregistrements des commandes et paiements effectués sont conservés, sans votre nom ni vos coordonnées, pendant la durée exigée par la législation fiscale et comptable. Voir la Politique de confidentialité.',
  'delete.acknowledge': 'Je comprends que mon compte et mes données seront supprimés définitivement.',
  'delete.typeToConfirm': 'Saisissez {{word}} pour confirmer',
  'delete.word': 'SUPPRIMER',
  'delete.submit': 'Supprimer mon compte',
  'delete.confirmTitle': 'Supprimer votre compte ?',
  'delete.confirmBody': 'Votre compte et vos données personnelles seront supprimés définitivement. Cette action est irréversible.',
  'delete.confirmAction': 'Supprimer',
  'delete.success.title': 'Compte supprimé',
  'delete.success.body': 'Votre compte a été supprimé. Nous sommes désolés de vous voir partir.',
  'delete.error': 'Impossible de supprimer votre compte. Vérifiez votre connexion et réessayez, ou contactez {{email}}.',
  'delete.alt': 'Vous pouvez aussi demander la suppression de votre compte en écrivant à {{email}}.',
};
