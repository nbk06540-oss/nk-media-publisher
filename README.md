# NK Media Publisher

Natorer Khonthoshor-এর জন্য responsive media publishing workspace-এর পরিষ্কার starter project।

## Render deployment

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

এই repository-তে `index.html` ও `index.js` একই root folder-এ রাখা হয়েছে। তাই `public/` বা `server/` folder path প্রয়োজন নেই।

## Local run

```bash
npm install
npm start
```

তারপর `http://localhost:10000` খুলুন।

## গুরুত্বপূর্ণ সীমাবদ্ধতা

এটি বর্তমানে একটি UI ও draft-queue demo। Facebook, YouTube বা TikTok-এ বাস্তবে পোস্ট প্রকাশ করে না। লাইভ প্রকাশের জন্য প্রতিটি প্ল্যাটফর্মের Developer App, OAuth অনুমোদন, প্রয়োজনীয় API permission, নিরাপদ server-side token storage এবং review/audit লাগবে।

কোনো Client Secret বা Access Token কখনো `index.html`-এ বা GitHub repository-তে রাখবেন না।