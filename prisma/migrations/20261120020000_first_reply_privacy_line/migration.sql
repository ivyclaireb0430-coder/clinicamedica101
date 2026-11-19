-- The privacy link is now one short line added by the bot to its first reply, so drop the longer
-- sentence from the default first reply (only if the clinic hasn't reworded it).
UPDATE "Script"
SET "body" = REPLACE("body", ' Bago po kayo magbahagi ng health details, paki-basa po ang aming privacy notice: [link].', '')
WHERE "key" = 'first_reply';
