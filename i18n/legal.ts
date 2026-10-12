import type { Language } from '@/store/settings-store';

/**
 * The Terms of use and Privacy policy, as shown in-app, in both languages.
 *
 * Kept as structured text rather than markdown so the screen can lay it out
 * with the app's own typography. `{{company}}` and `{{email}}` are filled from
 * `constants/support.ts` at render time, so a change of legal entity or
 * support address does not mean editing two documents in two languages.
 *
 * `updatedAt` is what the "Last updated" line shows: bump it whenever the text
 * changes — both stores expect a dated policy.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  /** ISO date. */
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}

const TERMS_UPDATED_AT = '2026-09-19';
const PRIVACY_UPDATED_AT = '2026-09-19';

const termsEn: LegalDocument = {
  title: 'Terms of use',
  updatedAt: TERMS_UPDATED_AT,
  intro:
    'These terms govern your use of the Hungry app and the food ordering and delivery service it provides, operated by {{company}}. By creating an account or placing an order you agree to them. If you do not agree, please do not use the app.',
  sections: [
    {
      heading: '1. Your account',
      paragraphs: [
        'You must be at least 18 years old to create an account and place orders. You are responsible for keeping your login details confidential and for everything done through your account.',
        'You agree to provide accurate contact details and a delivery address you are entitled to receive deliveries at, and to keep them up to date. We may suspend or close an account used in breach of these terms.',
      ],
    },
    {
      heading: '2. Orders',
      paragraphs: [
        'The app lets you order meals from partner restaurants. Menus, prices and availability are set by each restaurant and may change without notice. An order is only accepted once the restaurant confirms it; until then it may be declined, for example if an item is unavailable.',
        'The total shown at checkout includes the items, any delivery fee and service fee, and applicable taxes. Prices are shown in Tunisian dinar.',
      ],
    },
    {
      heading: '3. Payment',
      paragraphs: [
        'Payment is made using the methods offered at checkout. For cash on delivery, payment is due to the driver when the order is handed over. For card payments, the amount is charged when the restaurant confirms your order and processed by our payment provider; we never store full card numbers.',
      ],
    },
    {
      heading: '4. Delivery',
      paragraphs: [
        'Delivery times shown in the app are estimates and depend on the restaurant, traffic and weather. You must be reachable at the phone number on your account and available at the delivery address. If a delivery cannot be completed because you are unreachable or absent, the order may be charged in full.',
      ],
    },
    {
      heading: '5. Cancellations and refunds',
      paragraphs: [
        'You may cancel an order from the app while the restaurant has not confirmed it. Once preparation has started an order can no longer be cancelled from the app; contact support instead.',
        'If an order arrives incomplete, damaged or materially different from what was ordered, report it from the app within 24 hours. We will investigate with the restaurant and, where justified, refund or credit the affected items.',
      ],
    },
    {
      heading: '6. Acceptable use',
      paragraphs: [
        'You agree not to misuse the app: no fraudulent orders, no abuse or harassment of restaurant staff or drivers, no attempt to interfere with the service or access other customers’ data, and no use of the app for any unlawful purpose.',
      ],
    },
    {
      heading: '7. Reporting problems',
      paragraphs: [
        'You can report an order, a delivery, a restaurant, a bug or inappropriate content from Profile → Report a problem, or by writing to {{email}}. We review every report and may act on it, including by removing content or restricting accounts.',
      ],
    },
    {
      heading: '8. Intellectual property',
      paragraphs: [
        'The app, its design, logos and content belong to {{company}} or its licensors. Restaurant names, logos and menu photos belong to the respective restaurants. You may use the app only for ordering as a private customer.',
      ],
    },
    {
      heading: '9. Liability',
      paragraphs: [
        'We act as an intermediary between you, the restaurants and the delivery drivers. The restaurants are responsible for the preparation, quality and safety of the food, including allergen information. To the extent permitted by law, our liability for any order is limited to the amount you paid for it.',
        'Nothing in these terms excludes liability that cannot be excluded under applicable law, including your statutory rights as a consumer.',
      ],
    },
    {
      heading: '10. Ending your account',
      paragraphs: [
        'You can delete your account at any time from Profile → Delete account. Deletion is permanent and removes your personal data as described in the Privacy policy. We may close accounts that breach these terms.',
      ],
    },
    {
      heading: '11. Changes to these terms',
      paragraphs: [
        'We may update these terms from time to time. The date at the top shows the current version. Material changes are announced in the app; continuing to use the app after a change means you accept the updated terms.',
      ],
    },
    {
      heading: '12. Governing law',
      paragraphs: [
        'These terms are governed by the laws of Tunisia. Any dispute that cannot be resolved amicably is subject to the competent courts of Tunisia, without prejudice to any mandatory consumer protection rules that apply to you.',
      ],
    },
    {
      heading: '13. Contact',
      paragraphs: ['Questions about these terms: {{email}}.'],
    },
  ],
};

const termsFr: LegalDocument = {
  title: 'Conditions d’utilisation',
  updatedAt: TERMS_UPDATED_AT,
  intro:
    'Les présentes conditions régissent votre utilisation de l’application Hungry et du service de commande et de livraison de repas qu’elle propose, exploité par {{company}}. En créant un compte ou en passant une commande, vous les acceptez. Si vous n’êtes pas d’accord, veuillez ne pas utiliser l’application.',
  sections: [
    {
      heading: '1. Votre compte',
      paragraphs: [
        'Vous devez avoir au moins 18 ans pour créer un compte et passer des commandes. Vous êtes responsable de la confidentialité de vos identifiants et de tout ce qui est fait depuis votre compte.',
        'Vous vous engagez à fournir des coordonnées exactes et une adresse de livraison à laquelle vous êtes en droit de recevoir des livraisons, et à les tenir à jour. Nous pouvons suspendre ou fermer un compte utilisé en violation des présentes conditions.',
      ],
    },
    {
      heading: '2. Commandes',
      paragraphs: [
        'L’application vous permet de commander des repas auprès de restaurants partenaires. Les menus, prix et disponibilités sont définis par chaque restaurant et peuvent changer sans préavis. Une commande n’est acceptée qu’une fois confirmée par le restaurant ; jusque-là, elle peut être refusée, par exemple si un article est indisponible.',
        'Le total affiché au moment de commander comprend les articles, les éventuels frais de livraison et de service, et les taxes applicables. Les prix sont exprimés en dinar tunisien.',
      ],
    },
    {
      heading: '3. Paiement',
      paragraphs: [
        'Le paiement s’effectue selon les moyens proposés au moment de commander. En cas de paiement à la livraison, le règlement est dû au livreur à la remise de la commande. Pour les paiements par carte, le montant est débité à la confirmation de la commande par le restaurant et traité par notre prestataire de paiement ; nous ne conservons jamais de numéro de carte complet.',
      ],
    },
    {
      heading: '4. Livraison',
      paragraphs: [
        'Les délais de livraison affichés sont des estimations et dépendent du restaurant, de la circulation et de la météo. Vous devez être joignable au numéro de téléphone de votre compte et présent à l’adresse de livraison. Si une livraison ne peut aboutir parce que vous êtes injoignable ou absent, la commande peut être facturée en totalité.',
      ],
    },
    {
      heading: '5. Annulations et remboursements',
      paragraphs: [
        'Vous pouvez annuler une commande depuis l’application tant que le restaurant ne l’a pas confirmée. Une fois la préparation commencée, l’annulation n’est plus possible depuis l’application : contactez le support.',
        'Si une commande arrive incomplète, abîmée ou sensiblement différente de ce qui a été commandé, signalez-le depuis l’application dans les 24 heures. Nous enquêtons avec le restaurant et, si c’est justifié, remboursons ou créditons les articles concernés.',
      ],
    },
    {
      heading: '6. Usage acceptable',
      paragraphs: [
        'Vous vous engagez à ne pas détourner l’application : pas de commandes frauduleuses, pas d’abus ni de harcèlement envers le personnel des restaurants ou les livreurs, aucune tentative de perturber le service ou d’accéder aux données d’autres clients, et aucun usage à des fins illicites.',
      ],
    },
    {
      heading: '7. Signalements',
      paragraphs: [
        'Vous pouvez signaler une commande, une livraison, un restaurant, un bug ou un contenu inapproprié depuis Profil → Signalements, ou en écrivant à {{email}}. Nous examinons chaque signalement et pouvons agir en conséquence, y compris en retirant un contenu ou en restreignant un compte.',
      ],
    },
    {
      heading: '8. Propriété intellectuelle',
      paragraphs: [
        'L’application, son design, ses logos et ses contenus appartiennent à {{company}} ou à ses concédants. Les noms, logos et photos de menus des restaurants appartiennent aux restaurants concernés. Vous ne pouvez utiliser l’application que pour commander en tant que client particulier.',
      ],
    },
    {
      heading: '9. Responsabilité',
      paragraphs: [
        'Nous agissons comme intermédiaire entre vous, les restaurants et les livreurs. Les restaurants sont responsables de la préparation, de la qualité et de la sécurité des plats, y compris des informations sur les allergènes. Dans la mesure permise par la loi, notre responsabilité pour une commande est limitée au montant que vous avez payé pour celle-ci.',
        'Rien dans les présentes conditions n’exclut une responsabilité qui ne peut être exclue par la loi applicable, y compris vos droits légaux en tant que consommateur.',
      ],
    },
    {
      heading: '10. Fin du compte',
      paragraphs: [
        'Vous pouvez supprimer votre compte à tout moment depuis Profil → Supprimer le compte. La suppression est définitive et efface vos données personnelles comme décrit dans la Politique de confidentialité. Nous pouvons fermer les comptes qui enfreignent les présentes conditions.',
      ],
    },
    {
      heading: '11. Modification des conditions',
      paragraphs: [
        'Nous pouvons mettre à jour ces conditions. La date en haut de page indique la version en vigueur. Les changements importants sont annoncés dans l’application ; continuer à l’utiliser après un changement vaut acceptation des conditions mises à jour.',
      ],
    },
    {
      heading: '12. Droit applicable',
      paragraphs: [
        'Les présentes conditions sont régies par le droit tunisien. Tout litige qui ne peut être réglé à l’amiable relève des tribunaux tunisiens compétents, sans préjudice des règles impératives de protection des consommateurs qui vous sont applicables.',
      ],
    },
    {
      heading: '13. Contact',
      paragraphs: ['Pour toute question sur ces conditions : {{email}}.'],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: 'Privacy policy',
  updatedAt: PRIVACY_UPDATED_AT,
  intro:
    'This policy explains what personal data the Hungry app collects, why, who it is shared with and what your rights are. {{company}} is the data controller. We collect only what is needed to take your orders and deliver them.',
  sections: [
    {
      heading: '1. Data we collect',
      paragraphs: [
        'Account: your name, email address, phone number and a login (a password you choose, or a Google account you sign in with). We never see your Google password.',
        'Addresses and location: the delivery addresses you save, and, with your permission, your device location when you use the map to pick an address or delivery point. Location is read only while you use the app, never in the background.',
        'Orders: what you ordered, from which restaurant, the delivery address, the price, the payment method and the delivery status.',
        'Device: a push notification token (so we can notify you about your orders), the device model and operating system, and basic diagnostics when something fails.',
        'Support: the messages and reports you send us, including the order they relate to.',
      ],
    },
    {
      heading: '2. Why we use it',
      paragraphs: [
        'To perform the contract with you: create your account, take your orders, pass them to the restaurant and the driver, deliver to your address and take payment.',
        'With your consent: to read your device location, and to send push notifications about your orders. Both can be withdrawn at any time in your phone settings and in Profile → Preferences.',
        'For our legitimate interests: to keep the service secure, prevent fraud, handle your reports and improve the app.',
        'To meet legal obligations: to keep accounting records of sales and payments.',
        'We do not sell your data and do not use it for third-party advertising.',
      ],
    },
    {
      heading: '3. Who we share it with',
      paragraphs: [
        'The restaurant you order from receives your order and your first name; the driver receives your name, phone number and delivery address so they can reach you. Payment providers process card payments. Push notifications travel through Expo, Apple (APNs) and Google (FCM). Our servers are operated by hosting providers under contract. None of them may use your data for their own purposes.',
        'We disclose data to authorities only where the law requires it.',
      ],
    },
    {
      heading: '4. How long we keep it',
      paragraphs: [
        'Your account data is kept while your account exists. Order and payment records are kept for the period required by tax and accounting law (up to 10 years), after which they are deleted; once your account is deleted they no longer carry your name or contact details. Support messages are kept for 2 years. Push tokens are removed when you sign out, turn notifications off or delete your account.',
      ],
    },
    {
      heading: '5. Your rights',
      paragraphs: [
        'You can access and correct your data in Profile → Account management, and delete your account in Profile → Delete account. You may also ask us, at {{email}}, to access, correct, delete or export your data, or to object to a particular use. You have the right to lodge a complaint with your data protection authority (in Tunisia, the INPDP).',
      ],
    },
    {
      heading: '6. Account deletion',
      paragraphs: [
        'Deleting your account from the app removes your profile, addresses, login and device registrations immediately and permanently. Order and payment records are retained as described above, without personal identifiers. You can also request deletion by email at {{email}}; we act on such requests within 30 days.',
      ],
    },
    {
      heading: '7. Security',
      paragraphs: [
        'Data travels encrypted between the app and our servers. Your login is handled by a dedicated identity service that stores only a salted hash of your password. Access to personal data inside our systems is restricted to the staff who need it.',
      ],
    },
    {
      heading: '8. Children',
      paragraphs: [
        'The app is not intended for anyone under 18, and we do not knowingly collect data from children. If you believe a child has created an account, contact us and we will delete it.',
      ],
    },
    {
      heading: '9. Changes',
      paragraphs: [
        'We may update this policy; the date at the top shows the current version. Material changes are announced in the app.',
      ],
    },
    {
      heading: '10. Contact',
      paragraphs: ['Questions or requests about your data: {{email}}.'],
    },
  ],
};

const privacyFr: LegalDocument = {
  title: 'Politique de confidentialité',
  updatedAt: PRIVACY_UPDATED_AT,
  intro:
    'Cette politique explique quelles données personnelles l’application Hungry collecte, pourquoi, avec qui elles sont partagées et quels sont vos droits. {{company}} est le responsable du traitement. Nous ne collectons que ce qui est nécessaire pour prendre vos commandes et les livrer.',
  sections: [
    {
      heading: '1. Données collectées',
      paragraphs: [
        'Compte : votre nom, votre adresse e-mail, votre numéro de téléphone et un identifiant de connexion (un mot de passe que vous choisissez, ou un compte Google). Nous ne voyons jamais votre mot de passe Google.',
        'Adresses et localisation : les adresses de livraison que vous enregistrez et, avec votre autorisation, la position de votre appareil lorsque vous utilisez la carte pour choisir une adresse ou un point de livraison. La position n’est lue que pendant l’utilisation de l’application, jamais en arrière-plan.',
        'Commandes : ce que vous avez commandé, auprès de quel restaurant, l’adresse de livraison, le prix, le moyen de paiement et l’état de la livraison.',
        'Appareil : un jeton de notification push (pour vous informer de vos commandes), le modèle de l’appareil et son système, et des diagnostics de base en cas d’erreur.',
        'Support : les messages et signalements que vous nous envoyez, y compris la commande concernée.',
      ],
    },
    {
      heading: '2. Finalités',
      paragraphs: [
        'Exécuter le contrat avec vous : créer votre compte, prendre vos commandes, les transmettre au restaurant et au livreur, livrer à votre adresse et encaisser le paiement.',
        'Avec votre consentement : lire la position de votre appareil et vous envoyer des notifications push sur vos commandes. Les deux peuvent être retirés à tout moment dans les réglages du téléphone et dans Profil → Préférences.',
        'Pour nos intérêts légitimes : sécuriser le service, prévenir la fraude, traiter vos signalements et améliorer l’application.',
        'Pour respecter nos obligations légales : tenir la comptabilité des ventes et des paiements.',
        'Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité tierce.',
      ],
    },
    {
      heading: '3. Destinataires',
      paragraphs: [
        'Le restaurant auprès duquel vous commandez reçoit votre commande et votre prénom ; le livreur reçoit votre nom, votre numéro de téléphone et l’adresse de livraison pour pouvoir vous joindre. Les prestataires de paiement traitent les paiements par carte. Les notifications push transitent par Expo, Apple (APNs) et Google (FCM). Nos serveurs sont exploités par des hébergeurs sous contrat. Aucun d’eux ne peut utiliser vos données pour son propre compte.',
        'Nous ne communiquons des données aux autorités que lorsque la loi l’exige.',
      ],
    },
    {
      heading: '4. Durée de conservation',
      paragraphs: [
        'Les données de votre compte sont conservées tant que le compte existe. Les enregistrements de commandes et de paiements sont conservés pendant la durée exigée par la législation fiscale et comptable (jusqu’à 10 ans), puis supprimés ; une fois votre compte supprimé, ils ne portent plus votre nom ni vos coordonnées. Les messages au support sont conservés 2 ans. Les jetons de notification sont supprimés à la déconnexion, à la désactivation des notifications ou à la suppression du compte.',
      ],
    },
    {
      heading: '5. Vos droits',
      paragraphs: [
        'Vous pouvez consulter et corriger vos données dans Profil → Gestion du compte, et supprimer votre compte dans Profil → Supprimer le compte. Vous pouvez aussi nous demander, à {{email}}, d’accéder à vos données, de les corriger, de les supprimer ou de les exporter, ou vous opposer à un usage particulier. Vous avez le droit d’introduire une réclamation auprès de l’autorité de protection des données (en Tunisie, l’INPDP).',
      ],
    },
    {
      heading: '6. Suppression du compte',
      paragraphs: [
        'Supprimer votre compte depuis l’application efface immédiatement et définitivement votre profil, vos adresses, votre identifiant de connexion et les enregistrements de vos appareils. Les enregistrements de commandes et de paiements sont conservés comme indiqué ci-dessus, sans identifiant personnel. Vous pouvez aussi demander la suppression par e-mail à {{email}} ; nous y donnons suite sous 30 jours.',
      ],
    },
    {
      heading: '7. Sécurité',
      paragraphs: [
        'Les données circulent chiffrées entre l’application et nos serveurs. Votre connexion est gérée par un service d’identité dédié qui ne stocke qu’une empreinte salée de votre mot de passe. L’accès aux données personnelles dans nos systèmes est limité au personnel qui en a besoin.',
      ],
    },
    {
      heading: '8. Mineurs',
      paragraphs: [
        'L’application n’est pas destinée aux moins de 18 ans et nous ne collectons pas sciemment de données d’enfants. Si vous pensez qu’un enfant a créé un compte, contactez-nous et nous le supprimerons.',
      ],
    },
    {
      heading: '9. Modifications',
      paragraphs: [
        'Nous pouvons mettre à jour cette politique ; la date en haut de page indique la version en vigueur. Les changements importants sont annoncés dans l’application.',
      ],
    },
    {
      heading: '10. Contact',
      paragraphs: ['Questions ou demandes concernant vos données : {{email}}.'],
    },
  ],
};

export const TERMS_OF_USE: Record<Language, LegalDocument> = { en: termsEn, fr: termsFr };
export const PRIVACY_POLICY: Record<Language, LegalDocument> = { en: privacyEn, fr: privacyFr };
