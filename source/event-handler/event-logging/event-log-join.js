const { Events, Embed, EmbedBuilder } = require('discord.js');
const { db } = require('../../script');
const axios = require('axios');

const data = new Set();
process.on('unhandledRejection', (error) => console.error('error'));

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    async function loop() {
      const regex = /.\d{4}.\d{2}.\d{2}.\d{2}.\d{2}.\d{2}.\d{3}..\d{3}.(\d{4}.\d{2}.\d{2}.\d{2}.\d{2}.\d{2}).\s+(\w{0,})\s*(\w{0,})\s*\w{0,}\s*ARK/g;
      const platforms = { arkxb: true, arkps: true, arkse: true, arkswitch: true };

      const gameserver = async (document, reference, services) => {
        if (!reference.join) { return };
        const extraction = async (document, reference, service, { url }) => {
          const response = await axios.get(url, { headers: { 'Authorization': reference.nitrado.token } });
          if (response.status === 200) {

            let counter = 0;
            let result = '', pattern = '', unique = '';
            while ((result = regex.exec(response.data)) !== null && counter <= 10) {
              const [string, date, gamertag, condition] = result;
              const [datePart, timePart] = date.split('_');
              const dateTimeString = `${datePart.replace(/\./g, '-')}T${timePart.replace(/\./g, ':')}`;
              const unix = Math.floor(new Date(dateTimeString).getTime() / 1000);

              switch (condition) {
                case 'joined':
                  pattern += `<t:${unix}:F>\n\`\`\`\n🟢 ${gamertag} joined your server!\n\`\`\`\n`;
                  if (!data.has(pattern)) {
                    data.add(pattern), counter++;
                    unique += `<t:${unix}:F>\n\`\`\`\n🟢 ${gamertag} joined your server!\n\`\`\`\n`;
                  };
                  break;
                case 'left':
                  pattern += `<t:${unix}:F>\n\`\`\`\n🟠 ${gamertag} left your server!\n\`\`\`\n`;
                  if (!data.has(pattern)) {
                    data.add(pattern), counter++;
                    unique += `<t:${unix}:F>\n\`\`\`\n🟠 ${gamertag} left your server!\n\`\`\`\n`;
                  };
                  break;

                default:
                  break;
              };
            };

            if (!unique) { return };
            Object.entries(reference.join).forEach(async entry => {
              if (parseInt(entry[0]) === service.id) {
                try {
                  const channel = await client.channels.fetch(entry[1]);
                  const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setFooter({ text: `Tip: Contact support if there are issues.` })
                    .setDescription(`${unique}`);

                  await channel.send({ embeds: [embed] });
                } catch (error) { null };
              };
            });
          };
        };

        const path = async (document, reference, service, { game_specific: { path } }) => {
          try {
            const url = `https://api.nitrado.net/services/${service.id}/gameservers/file_server/download?file=${path}/ShooterGame/Saved/Logs/ShooterGame.log`;
            const response = await axios.get(url, { headers: { 'Authorization': reference.nitrado.token } });
            if (response.status === 200) { await extraction(document, reference, service, response.data.data.token); };
          } catch (error) { null };
        };

        const tasks = await services.map(async service => {
          const url = `https://api.nitrado.net/services/${service.id}/gameservers`;
          const response = await axios.get(url, { headers: { 'Authorization': reference.nitrado.token } });
          if (response.status === 200 && platforms[response.data.data.gameserver.game] && response.data.data.gameserver.query.server_name) {
            await path(document, reference, service, response.data.data.gameserver);
          };
        });

        await Promise.all(tasks).then(async () => {
          console.log('Join Finished:')
        });
      };

      const service = async (document, reference) => {
        try {
          const url = 'https://api.nitrado.net/services';
          const response = await axios.get(url, { headers: { 'Authorization': reference.nitrado.token } });
          response.status === 200 ? gameserver(document, reference, response.data.data.services) : unauthorized();
        } catch (error) { unauthorized() };
      };

      const token = async (document, reference) => {
        try {
          const url = 'https://oauth.nitrado.net/token';
          const response = await axios.get(url, { headers: { 'Authorization': reference.nitrado.token } });
          response.status === 200 ? service(document, reference) : unauthorized();
        } catch (error) { unauthorized() };
      };

      const reference = await db.collection('ase-configuration').get();
      reference.forEach(doc => {
        doc.data() ? token(doc.id, doc.data()) : console.log('Invalid document.');
      });
      setTimeout(loop, 60000);
    };
    // loop().then(() => console.log('Loop started:'));
  },
};