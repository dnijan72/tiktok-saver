# iPhone Shortcut: "Save TikTok"

Share a TikTok → the video lands in Photos and the caption is on your clipboard.

Replace `YOUR-LINK` with your workers.dev address and `YOUR-CODE` with your ACCESS_TOKEN.

1. Open **Shortcuts** → **+** → name it **Save TikTok**.
2. Tap the **ⓘ** (or the name at the top) → turn on **Show in Share Sheet**. Under "Receives", keep **URLs** and **Text** and turn the rest off.
3. Add **Get Contents of URL**:
   - URL: `https://YOUR-LINK/api/info`
   - Tap **Show More** → Method **POST**
   - Headers: add `Authorization` = `Bearer YOUR-CODE`
   - Request Body **JSON**: add `url` (Text) = **Shortcut Input**, and `account` (Text) = `newyorkers`
4. Add **Get Dictionary Value**: get **Value** for key `full` in **Contents of URL**.
5. Add **Copy to Clipboard** (Dictionary Value).
6. Add another **Get Contents of URL**:
   - URL: `https://YOUR-LINK/api/video`
   - Method **POST**, same `Authorization` header
   - Request Body **JSON**: `url` (Text) = **Shortcut Input**
7. Add **Save to Photo Album** (Contents of URL) → album **Recents**.
8. Add **Show Notification**: `Saved to Photos. Caption copied.`

To use it: in TikTok tap **Share** → **More** (or scroll the row) → **Save TikTok**. The first run asks permission to reach your link and Photos; tap **Always Allow**.

If something fails, the shortcut shows TikTok Saver's error text. The web page shows the same info with more detail.
