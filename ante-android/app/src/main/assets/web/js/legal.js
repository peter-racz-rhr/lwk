/* Ante's legal documents, shown in the app (Profile → Legal) and exported to docs/legal/.
   Drafts written from how the app actually works. Have them reviewed by a lawyer before publishing.
   TODO(owner): add the postcode and town to ADDRESS. */
(function () {
  "use strict";
  const OWNER = "Péter Rácz";
  const ADDRESS = "Kálti Márk u. 2/B, Hungary";
  const EMAIL = "peter.racz.rhr@gmail.com";
  const PHONE = "+36 50 104 5007";
  const UPDATED = "31 October 2026";

  const DOCS = {
    imprint: {
      title: "Imprint",
      intro: "Information about the provider of Ante, as required for online services in Hungary and the EU.",
      sections: [
        ["Provider", `Ante is made and run by ${OWNER}, a private individual.`],
        ["Address", ADDRESS],
        ["Contact", `Email: ${EMAIL}<br>Phone: ${PHONE}`],
        ["Responsible for content", OWNER],
        ["Business details", "Ante is a free, non-commercial project. It has no company registration or VAT number. Voluntary tips through Ko-fi do not buy any product or service."],
        ["Online dispute resolution", "The provider is not obliged and not willing to take part in dispute resolution before a consumer arbitration board."],
      ],
    },
    terms: {
      title: "Terms of Service",
      intro: `These terms apply when you use the Ante app and its web demo. Last updated ${UPDATED}.`,
      sections: [
        ["1. What Ante is", "Ante is a screen-time tool. You set daily time limits for apps on your phone. When a limit is used up, Ante covers that app. The tables (roulette, blackjack, slots, poker and coin flip) let you stake minutes of that time budget."],
        ["2. No real money, no prizes", "Ante is not a gambling service. You cannot pay money into the tables, and you cannot win money, goods or anything else of value. Minutes won or lost only change the time limits you set yourself, and they reset every day. Every table returns a little less than it takes on average, so over time playing reduces your screen time."],
        ["3. Who can use it", "You need to be at least 16 years old. If gambling-style games are a problem for you, or might become one, please don't use the tables. If gambling, even with time, starts to feel like a problem, talk to your doctor or a support service near you."],
        ["4. Your phone and its settings", "Blocking needs Android's accessibility permission, which you can turn on and off in Settings at any time. Ante can't guarantee that every app is blocked in every situation, for example web versions of apps or picture-in-picture video. Strict mode adds a 30-second wait before Settings and uninstalling; it is meant as friction, not as a lock you can't undo."],
        ["5. Your account", "Signing in with Google is optional. It only puts your name and email on this phone. You can sign out at any time in Profile."],
        ["6. Tips", "You can tip the developer through Ko-fi. Tips are voluntary gifts, are handled by Ko-fi under its own terms, and don't unlock anything in the app."],
        ["7. Use at your own risk", "Ante is provided free of charge and \"as is\". To the extent the law allows, the provider is not liable for damage caused by using or not being able to use Ante, for example a missed message because an app was covered. Liability for intent and gross negligence, and for harm to life, body or health, is not excluded."],
        ["8. Changes", "These terms may change when the app changes. The date at the top shows the latest version. If you keep using Ante after a change, the new terms apply."],
        ["9. Law and contact", `Hungarian law applies. Questions: ${EMAIL}.`],
      ],
    },
    privacy: {
      title: "Privacy Policy",
      intro: `How Ante handles your data. Last updated ${UPDATED}. In short: everything stays on your phone, and Ante has no server.`,
      sections: [
        ["Who is responsible", `${OWNER}, ${ADDRESS}. Email: ${EMAIL}, phone: ${PHONE}.`],
        ["What stays on your phone", "Your limits, the time left and used per app, your daily history (about six months), your table results, your settings and your theme. This is stored only on your device. Ante has no internet permission and sends none of it anywhere."],
        ["Which app is in front", "With the accessibility permission on, Android tells Ante the name of the app that comes to the front, so Ante can cover apps that are over their limit. Ante does not read what is on your screen, what you type or your notifications. The app names are used on the phone and not stored beyond your usage totals."],
        ["Google sign-in (optional)", "If you sign in with Google, Google shows its own sign-in screen and gives Ante your name and email address, which are saved on your phone. Google processes this sign-in under its own privacy policy (policies.google.com/privacy). Ante does not keep the Google sign-in token. Legal basis: your consent (GDPR Art. 6(1)(a)), which you can withdraw by signing out."],
        ["The app list", "To let you pick apps, Ante reads the list of apps installed on your phone and their icons. This list stays on the phone."],
        ["Web demo", "The web demo runs in your browser with sample data and stores its state in your browser's local storage. The host (Netlify or Vercel) may keep standard server logs, such as IP addresses, under its own privacy policy."],
        ["Ko-fi", "The Ko-fi link opens ko-fi.com in your browser. Anything you do there is handled by Ko-fi under its own privacy policy."],
        ["How long", "On-device data stays until you uninstall Ante or clear its data in Android settings. Daily history is limited to about six months. Signing out deletes your name and email right away."],
        ["Your rights", `Under the GDPR you have the right to access, correct and delete your data, to restrict or object to processing, to data portability and to withdraw consent. Because the data is on your phone, you can delete it yourself at any time. For anything else write to ${EMAIL}.`],
        ["Complaints", "You can complain to the Hungarian data protection authority: Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH), Falk Miksa utca 9–11, 1055 Budapest, naih.hu."],
        ["Children", "Ante is not meant for children under 16."],
        ["Changes", "If this policy changes, the date at the top changes, and important changes are shown in the app."],
      ],
    },
  };

  window.AnteLegal = { DOCS, OWNER, EMAIL, PHONE, ADDRESS, UPDATED };
  if (typeof module !== "undefined") module.exports = window.AnteLegal;
})();
