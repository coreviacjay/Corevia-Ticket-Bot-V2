const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create the ticket panel (Admin only)')
    .setDefaultMemberPermissions('ManageChannels'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageChannels')) {
      return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Create a Ticket')
      .setDescription('Select a category below to open a ticket.')
      .setColor('#00ff00')
      .setFooter({ text: 'Corevia Global Support' });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('create_ticket')
      .setPlaceholder('Select a category...')
      .addOptions(
        config.ticketCategories.map(cat => 
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.name)
            .setDescription(cat.description)
            .setEmoji(cat.emoji)
            .setValue(cat.name)
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Ticket panel created!', ephemeral: true });
  }
};