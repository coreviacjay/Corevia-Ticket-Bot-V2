const { Client, GatewayIntentBits, Collection, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
client.config = config;

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Error!', ephemeral: true });
    }
  }

  // Ticket category selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'create_ticket') {
    const selected = interaction.values[0];
    const category = config.ticketCategories.find(c => c.name === selected);
    if (!category) return;

    const guild = interaction.guild;
    const channel = await guild.channels.create({
      name: `${config.ticketPrefix}${interaction.user.username}-${selected.toLowerCase().replace(/ /g, '-')}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: category.roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: config.supportRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
      ],
      topic: `Opened by: ${interaction.user.tag} | Category: ${selected} | Claimed by: None`
    });

    const claimBtn = new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Primary);

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(claimBtn, closeBtn);

    await channel.send({
      content: `${interaction.user}, your ticket has been created!\n<@&${category.roleId}> will assist you shortly.`,
      components: [row]
    });

    await interaction.reply({ content: `Ticket created → ${channel}`, ephemeral: true });
  }

  // Claim / Unclaim button
  if (interaction.isButton() && interaction.customId === 'claim_ticket') {
    const channel = interaction.channel;
    if (!channel.name.startsWith(config.ticketPrefix)) return;

    let topic = channel.topic || '';
    if (topic.includes('Claimed by: None')) {
      topic = topic.replace('Claimed by: None', `Claimed by: ${interaction.user.tag}`);
      await channel.setTopic(topic);
      await interaction.update({
        content: `Ticket claimed by ${interaction.user}`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
        )]
      });
    }
  }

  if (interaction.isButton() && interaction.customId === 'unclaim_ticket') {
    const channel = interaction.channel;
    let topic = channel.topic || '';
    topic = topic.replace(/Claimed by: .+/, 'Claimed by: None');
    await channel.setTopic(topic);
    await interaction.update({
      content: `Ticket unclaimed.`,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      )]
    });
  }

  // Close ticket + transcript
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    if (!channel.name.startsWith(config.ticketPrefix)) return;

    // Generate simple transcript
    let transcript = `Ticket Transcript - ${channel.name}\n`;
    transcript += `Opened by: ${channel.topic.split('Opened by: ')[1].split(' | ')[0]}\n`;
    transcript += `Closed by: ${interaction.user.tag}\n`;
    transcript += `Time: ${new Date().toLocaleString()}\n\n`;
    transcript += '----------------------------------------\n\n';

    const messages = await channel.messages.fetch({ limit: 100 });
    messages.reverse().forEach(msg => {
      if (msg.author.bot) return;
      transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content || '[Attachment/Embed]'}\n`;
    });

    // Send to log channel
    const logChannel = client.channels.cache.get(config.logChannelId);
    if (logChannel) {
      await logChannel.send({
        embeds: [new EmbedBuilder()
          .setTitle(`Ticket Closed: ${channel.name}`)
          .setDescription(`Closed by ${interaction.user}\nTranscript attached.`)
          .setColor('#ff0000')
          .setTimestamp()],
        files: [{ attachment: Buffer.from(transcript), name: `${channel.name}-transcript.txt` }]
      });
    }

    await interaction.reply({ content: 'Closing ticket in 5 seconds...', fetchReply: true });
    setTimeout(() => channel.delete(), 5000);
  }
});

// Ready
client.once('ready', () => {
  console.log(`Corevia Ticket Bot V2 online as ${client.user.tag}`);
});

client.login(config.token);