<div align="center">

# 🎓 My Study Friends a.k.a Study Mate

### *Stop studying alone. Start studying smarter.*

**Find your perfect study partner in seconds — no sign-up forms, no passwords, no stress.**

[![Live App](https://img.shields.io/badge/🚀_Live_App-mystudyfriends.netlify.app-00ffc8?style=for-the-badge&labelColor=050810)](https://mystudyfriends.netlify.app)

---

<!-- 📸 SCREENSHOT -->
<img width="1644" height="681" alt="image" src="https://github.com/user-attachments/assets/bd8f31a1-d4f2-4bdd-a7e4-b0cf3b2c93df" />


---

</div>

## ✨ What is My Study Friends?

Ever crammed for an exam alone at 2am wishing you had someone to quiz you? Ever sat in the library surrounded by strangers when all you needed was one person studying the same subject?

**My Study Friends** fixes that.

It's a free platform that connects you with students who match your subjects, your study style, and your schedule. Browse real student profiles, read their bios, and reach out directly through Instagram, LinkedIn or Discord — with optional profile details you choose to share with signed-in students.

Think of it as a **study buddy finder built for uni students**, by students.

---

## 🔥 Why students love it

<table>
<tr>
<td width="50%">

### 👁️ See everyone at once
No swiping through one card at a time. Browse the full student network in a clean gallery — scan bios, check subjects, and spot your match instantly.

</td>
<td width="50%">

### 🔒 Your privacy, protected
Choose what you share: city, university, subjects, bio and social handles are optional and visible to signed-in students. No email address or student ID is required.

</td>
</tr>
<tr>
<td width="50%">

### ⚡ On in seconds
No lengthy sign-up. Pick your avatar, type your first name, add your subjects — done. You're in the network and visible to other students immediately.

</td>
<td width="50%">

### 📱 Works on any device
Phone, tablet, laptop — the app adapts to your screen. Study on the go or settle in at the library, it looks great everywhere.

</td>
</tr>
<tr>
<td width="50%">

### 🔍 Find your match fast
Search by name, subject, university or study style in real time. Looking for someone who does late-night exam cramming? One search away.

</td>
<td width="50%">

### 🎨 Your profile, your way
Update your avatar, bio, subjects and availability any time. Your study life changes every semester — your profile should too.

</td>
</tr>
</table>

---
## 🎯 Perfect for

- 📚 Finding a study partner for your toughest unit
- 🧑‍💻 Group project teammates who actually pull their weight
- 📝 Someone to do past paper practice with before finals
- ☕ A coffee catch-up study session on campus
- 🌙 Late-night Discord study sessions when the library is closed
- 🏫 New students wanting to meet people in their degree

---

## 🛡️ Built with your privacy in mind

My Study Friends was designed from day one with a simple rule: **collect only what's necessary, expose only what you choose.**

- No passwords — your browser remembers you, with a private recovery code for other devices
- No tracking or analytics cookies; a secure session cookie remembers your sign-in
- No ads — ever
- Contact details are optional and fully controlled by you
- The platform never sells or shares your data

---

## 💬 What students say

> *"Finally found someone doing MATH1051 at the same time as me. We've been studying together every week since."*
> — **Computer Science student, QUT**

> *"I'm an international student and was really struggling to meet people. This helped me find my whole study group."*
> — **Engineering student, UQ**

> *"I love that it doesn't ask for my email. Just a name and avatar and I'm in."*
> — **Business student, Griffith**

---

## 📲 Access your account

**New student?** → [mystudyfriends.netlify.app](https://mystudyfriends.netlify.app) → **Initialize Profile**

**Returning?** → Your usual browser remembers you for up to 90 days. On another device, click **Access Existing** and paste your saved recovery code.

**Lost your code and signed out?** → Create a new profile. There is no email recovery.

---

<div align="center">

**Made for students. Built to connect. Free forever.**

[🚀 Start Finding Study Buddies →](https://mystudyfriends.netlify.app)

---

*My Study Friends — Shared interests. Real connections.*

</div>


## Authentication and deployment

Existing Azure Table Storage and Netlify environment variables are used; no email service or new database is required. Public profile UUIDs remain internal identifiers, never login credentials. New profiles receive a cryptographically random 96-bit recovery code, shown once with copy/download options. Only its SHA-256 hash is stored in the `recovery` partition. Treat the downloaded code as private.

Browser sessions use random tokens in Secure, HttpOnly, SameSite=Strict cookies with a 90-day lifetime. Hashed tokens and expiry timestamps are stored in the `session` partition. Logout deletes the server session. Expired session records are rejected; automatic storage cleanup is not implemented. Profile listing, editing, and the legacy swipe/match endpoints require a valid session. Profile contacts remain visible to signed-in students.

Deploy the frontend and all functions together.

Run `npm install` and `npm test` for authentication checks. For local use, run through Netlify Dev on localhost so functions and the frontend share an origin. Deploy through the site's existing Netlify workflow; this change adds no environment variables. Never put Azure keys in frontend files.


## Universities, cities and connection maps

Registration and profile editing offer a dropdown of 42 Australian universities from [Study Australia](https://www.studyaustralia.gov.au/en/plan-your-studies/list-of-australian-universities), retrieved 26 October 2026. Choose the last option to enter an institution or university team manually. The city field suggests common cities and accepts custom entries. Both fields are optional, visible to signed-in students, and stored on the existing Azure profile entity; no database migration is needed.

The Study Network opens an interactive connection map, with an alternative grouped cards view. Switch between city and university grouping; search applies to both views, including city. Drag a student card or open it with a click, Enter or Space. Shared subjects create violet links. Callouts count shared subjects, study styles and availability across distinct profiles; click one to highlight its members. Missing locations form an explicit “not shared” group.

This is an explainable JavaScript simulation, not an external AI model. Matching ignores capitalization and repeated spaces; it does not infer interests from bios. No profile data goes to an AI service. Map previews show at most 60 students and 12 per group to limit rendering work; cards show every matching student. Reduced-motion preferences disable the spring animation.

“Try a demo network” previews clearly labelled fictional profiles in memory only. It never creates database records or mixes demo students with real students. University data lives in `public/js/universities.js`; clustering and rendering live in `public/js/network-model.js` and `public/js/network-view.js`.
