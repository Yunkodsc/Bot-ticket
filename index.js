require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActivityType,
} = require("discord.js");

// ============================================================
// NEYVO TICKET — CONFIGURATION
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const CONFIG_FILE = path.join(__dirname, "neyvo-config.json");
const OWNERS_FILE = path.join(__dirname, "neyvo-owners.json");

const DEFAULT_CATEGORIES = [
  { id: "nitro", name: "Nitro Boosts", emoji: "🚀" },
  { id: "decorations", name: "Decorations", emoji: "🎨" },
  { id: "exchanges", name: "Exchanges", emoji: "🔄" },
  { id: "serverboosts", name: "Servers Boosts", emoji: "⚡" },
  { id: "accounts", name: "Aged Discord Accounts", emoji: "👤" },
];

const DEFAULT_CONFIG = {
  panelTitle: "🎫・Centre de tickets",
  panelDescription:
    "Bienvenue sur le support Neyvo !\n\nSélectionne une catégorie ci-dessous pour ouvrir un ticket.\nNotre équipe te répondra dès que possible.",
  panelColor: "#5865F2",
  panelStyle: "dropdown",
  categories: DEFAULT_CATEGORIES,
  ticketCategoryId: null,
  staffRoleId: null,
  logChannelId: null,
  ticketCategoryId: null,
  panelChannelId: null,
  panelMessageId: null,
  guildId: process.env.GUILD_ID || null,
};

// ============================================================
// FICHIERS JSON
// ============================================================

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return structuredClone(fallback);
    }

    const content = JSON.parse(fs.readFileSync(file, "utf8"));

    return content && typeof content === "object"
      ? content
      : structuredClone(fallback);
  } catch (error) {
    console.error(`Erreur de lecture ${path.basename(file)} :`, error.message);
    return structuredClone(fallback);
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erreur d'écriture ${path.basename(file)} :`, error.message);
  }
}

function normalizeColor(value) {
  if (typeof value !== "string") return "#5865F2";

  let color = value.trim();

  if (!color.startsWith("#")) color = `#${color}`;

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return "#5865F2";

  return color.toUpperCase();
}

function colorNumber() {
  return Number.parseInt(normalizeColor(config.panelColor).slice(1), 16);
}

function makeId() {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeCategory(category) {
  return {
    id: safeText(category?.id, makeId()).slice(0, 100),
    name: safeText(category?.name, "Nouveau ticket").slice(0, 100),
    emoji: safeText(category?.emoji, "🎫").slice(0, 100) || "🎫",
  };
}

// ============================================================
// CHARGEMENT DE LA CONFIGURATION
// ============================================================

const loadedConfig = readJSON(CONFIG_FILE, DEFAULT_CONFIG);

const config = {
  ...structuredClone(DEFAULT_CONFIG),
  ...loadedConfig,
  panelColor: normalizeColor(loadedConfig.panelColor),
  panelStyle:
    loadedConfig.panelStyle === "buttons" ? "buttons" : "dropdown",
  categories: Array.isArray(loadedConfig.categories)
    ? loadedConfig.categories.map(normalizeCategory)
    : structuredClone(DEFAULT_CATEGORIES),
  ticketCategoryId: loadedConfig.ticketCategoryId || null,
};

if (!config.categories.length) {
  config.categories = structuredClone(DEFAULT_CATEGORIES);
}

function saveConfig() {
  writeJSON(CONFIG_FILE, config);
}

// ============================================================
// OWNERS
// ============================================================

const loadedOwners = readJSON(OWNERS_FILE, { owners: [] });

const envOwners = (process.env.OWNER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => /^\d{17,20}$/.test(id));

const owners = new Set([
  ...(Array.isArray(loadedOwners.owners)
    ? loadedOwners.owners.map(String)
    : []),
  ...envOwners,
]);

function saveOwners() {
  writeJSON(OWNERS_FILE, { owners: [...owners] });
}

function isOwner(userId) {
  return owners.has(userId);
}

function isStaff(member) {
  if (!member) return false;

  if (isOwner(member.id)) return true;

  if (
    config.staffRoleId &&
    member.roles?.cache?.has(config.staffRoleId)
  ) {
    return true;
  }

  return Boolean(
    member.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

// ============================================================
// EMOJIS — CORRECTION DE L'ERREUR INVALID EMOJI
// ============================================================

function isValidUnicodeEmoji(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  const emoji = value.trim();

  const containsEmoji =
    /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji);

  const containsLettersOrNumbers = /[\p{Letter}\p{Number}]/u.test(emoji);

  return containsEmoji && !containsLettersOrNumbers;
}

function parseDiscordEmoji(emoji) {
  const fallback = { name: "🎫" };

  if (typeof emoji !== "string" || !emoji.trim()) {
    return fallback;
  }

  const value = emoji.trim();

  const customMatch = value.match(
    /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{17,20})>$/
  );

  if (customMatch) {
    return {
      name: customMatch[2],
      id: customMatch[3],
      animated: customMatch[1] === "a",
    };
  }

  if (value.startsWith("<") || value.endsWith(">")) {
    return fallback;
  }

  if (!isValidUnicodeEmoji(value)) {
    return fallback;
  }

  return { name: value };
}

function getEmojiMarkup(emoji) {
  if (typeof emoji !== "string" || !emoji.trim()) return "🎫";

  const value = emoji.trim();

  if (/^<a?:[a-zA-Z0-9_]{2,32}:\d{17,20}>$/.test(value)) {
    return value;
  }

  return isValidUnicodeEmoji(value) ? value : "🎫";
}

function setSafeEmoji(component, emoji) {
  try {
    component.setEmoji(parseDiscordEmoji(emoji));
  } catch {
    component.setEmoji("🎫");
  }

  return component;
}

// ============================================================
// OUTILS GÉNÉRAUX
// ============================================================

function getCategory(categoryId) {
  return config.categories.find((category) => category.id === categoryId);
}

function getCategoryName(categoryId) {
  return getCategory(categoryId)?.name || "Ticket";
}

function slugify(value) {
  return safeText(value, "ticket")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "ticket";
}

function makeEmbed(title, description, color = config.panelColor) {
  return new EmbedBuilder()
    .setColor(normalizeColor(color))
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Neyvo Ticket" })
    .setTimestamp();
}

async function safeReply(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp({
        content,
        ephemeral: true,
      });
    }

    return await interaction.reply({
      content,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Impossible d'envoyer la réponse :", error.message);
  }
}

async function getTextChannel(guild, channelId) {
  if (!guild || !channelId) return null;

  try {
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) return null;

    return channel;
  } catch {
    return null;
  }
}

// ============================================================
// PANEL PUBLIC
// ============================================================

function buildPublicPanelEmbed() {
  return new EmbedBuilder()
    .setColor(colorNumber())
    .setTitle(config.panelTitle || "🎫・Centre de tickets")
    .setDescription(
      config.panelDescription ||
        "Sélectionne une catégorie pour ouvrir un ticket."
    )
    .setFooter({ text: "Dev by Yunko" })
    .setTimestamp();
}

function buildPublicPanelComponents() {
  const rows = [];

  if (config.panelStyle === "buttons") {
    const categories = config.categories.slice(0, 25);

    for (let i = 0; i < categories.length; i += 5) {
      const row = new ActionRowBuilder();

      for (const category of categories.slice(i, i + 5)) {
        const button = new ButtonBuilder()
          .setCustomId(`ticket_create:${category.id}`)
          .setLabel(category.name.slice(0, 80))
          .setStyle(ButtonStyle.Primary);

        setSafeEmoji(button, category.emoji);

        row.addComponents(button);
      }

      rows.push(row);
    }

    return rows;
  }

  const options = config.categories.slice(0, 25).map((category) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(category.name.slice(0, 100))
      .setValue(category.id)
      .setDescription(`Ouvrir un ticket : ${category.name}`.slice(0, 100));

    setSafeEmoji(option, category.emoji);

    return option;
  });

  if (!options.length) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel("Support")
        .setValue("support")
        .setDescription("Ouvrir un ticket")
        .setEmoji("🎫")
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category_select")
        .setPlaceholder("🎫・Choisis la catégorie de ton ticket")
        .addOptions(options)
    )
  );

  return rows;
}

async function publishPublicPanel(channel, updateExisting = false) {
  if (!channel || !channel.isTextBased()) {
    throw new Error("Le salon du panel est introuvable.");
  }

  const payload = {
    embeds: [buildPublicPanelEmbed()],
    components: buildPublicPanelComponents(),
  };

  if (updateExisting && config.panelMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(config.panelMessageId);

      await oldMessage.edit(payload);

      config.panelChannelId = channel.id;
      saveConfig();

      return oldMessage;
    } catch {
      // Si l'ancien message n'existe plus, on en crée un nouveau.
    }
  }

  const message = await channel.send(payload);

  config.panelChannelId = channel.id;
  config.panelMessageId = message.id;
  config.guildId = channel.guild.id;

  saveConfig();

  return message;
}

async function refreshPublishedPanel(guild) {
  if (!guild || !config.panelChannelId || !config.panelMessageId) {
    return false;
  }

  const channel = await getTextChannel(guild, config.panelChannelId);

  if (!channel) return false;

  try {
    const message = await channel.messages.fetch(config.panelMessageId);

    await message.edit({
      embeds: [buildPublicPanelEmbed()],
      components: buildPublicPanelComponents(),
    });

    return true;
  } catch (error) {
    console.error("Actualisation du panel impossible :", error.message);
    return false;
  }
}

// ============================================================
// LOGS
// ============================================================

async function sendLog(guild, title, description, color = "#5865F2") {
  if (!config.logChannelId) return;

  const channel = await getTextChannel(guild, config.logChannelId);

  if (!channel) return;

  try {
    await channel.send({
      embeds: [makeEmbed(title, description, color)],
    });
  } catch (error) {
    console.error("Erreur d'envoi des logs :", error.message);
  }
}

// ============================================================
// TICKETS
// ============================================================

function getOpenTicketForUser(guild, userId) {
  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(`ticketOwner=${userId}`) &&
      channel.topic?.includes("ticketOpen=true")
  );
}

function isTicketChannel(channel) {
  return Boolean(
    channel &&
      channel.type === ChannelType.GuildText &&
      typeof channel.topic === "string" &&
      channel.topic.includes("ticketOwner=") &&
      channel.topic.includes("ticketCategory=")
  );
}

function getTicketOwnerId(channel) {
  const match = channel.topic?.match(/ticketOwner=(\d+)/);
  return match ? match[1] : null;
}

function getTicketCategoryId(channel) {
  const match = channel.topic?.match(/ticketCategory=([^;]+)/);
  return match ? match[1] : null;
}

function setTicketTopicValue(topic, key, value) {
  const parts = (topic || "")
    .split(";")
    .filter(Boolean)
    .filter((part) => !part.startsWith(`${key}=`));

  parts.push(`${key}=${value}`);

  return parts.join(";");
}

async function createTicket(interaction, categoryId) {
  const guild = interaction.guild;
  const category = getCategory(categoryId);

  if (!guild || !interaction.member) {
    return safeReply(
      interaction,
      "❌ Cette action doit être utilisée sur un serveur."
    );
  }

  if (!category) {
    return safeReply(interaction, "❌ Cette catégorie n'existe plus.");
  }

  const existingTicket = getOpenTicketForUser(guild, interaction.user.id);

  if (existingTicket) {
    return safeReply(
      interaction,
      `❌ Tu as déjà un ticket ouvert : ${existingTicket}`
    );
  }

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (config.staffRoleId) {
    permissionOverwrites.push({
      id: config.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  const channelName =
    `${slugify(category.name)}-${slugify(interaction.user.username)}`.slice(
      0,
      95
    );

  let ticketChannel;

  try {
    // Vérifie que la catégorie Discord configurée existe toujours.
    let parentCategory = null;

    if (config.ticketCategoryId) {
      parentCategory = await guild.channels
        .fetch(config.ticketCategoryId)
        .catch(() => null);

      if (
        !parentCategory ||
        parentCategory.type !== ChannelType.GuildCategory
      ) {
        console.warn(
          "La catégorie Discord des tickets est introuvable ou invalide. Création sans catégorie."
        );

        config.ticketCategoryId = null;
        saveConfig();
        parentCategory = null;
      }
    }

    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      ...(parentCategory ? { parent: parentCategory.id } : {}),
      topic: `ticketOwner=${interaction.user.id};ticketCategory=${category.id};ticketOpen=true`,
      permissionOverwrites,
      reason: `Ouverture d'un ticket par ${interaction.user.tag}`,
    });
  } catch (error) {
    console.error("Création du ticket impossible :", error);

    return safeReply(
      interaction,
      "❌ Impossible de créer le ticket. Vérifie les permissions du bot."
    );
  }

  const embed = new EmbedBuilder()
    .setColor(colorNumber())
    .setTitle(`${getEmojiMarkup(category.emoji)} ${category.name}`)
    .setDescription(
      [
        `Bonjour ${interaction.user} !`,
        "",
        "Ton ticket a bien été créé.",
        "Explique-nous ta demande et un membre du staff te répondra.",
        "",
        `**Créé par :** ${interaction.user}`,
        `**Catégorie :** ${category.name}`,
        "**Statut :** En attente",
      ].join("\n")
    )
    .setFooter({ text: "Neyvo Ticket • Support" })
    .setTimestamp();

  const ticketButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Prendre en charge")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_unclaim")
      .setLabel("Libérer")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Fermer")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  try {
    await ticketChannel.send({
      content: `${interaction.user}${
        config.staffRoleId ? ` <@&${config.staffRoleId}>` : ""
      }`,
      embeds: [embed],
      components: [ticketButtons],
      allowedMentions: {
        users: [interaction.user.id],
        roles: config.staffRoleId ? [config.staffRoleId] : [],
      },
    });
  } catch (error) {
    console.error("Envoi du message ticket impossible :", error.message);
  }

  await sendLog(
    guild,
    "🎫 Ticket créé",
    [
      `**Salon :** ${ticketChannel}`,
      `**Utilisateur :** ${interaction.user.tag} (${interaction.user.id})`,
      `**Catégorie :** ${category.name}`,
    ].join("\n"),
    "#57F287"
  );

  return safeReply(interaction, `✅ Ton ticket a été créé : ${ticketChannel}`);
}

async function claimTicket(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    return safeReply(interaction, "❌ Ce salon n'est pas un ticket.");
  }

  if (!isStaff(interaction.member)) {
    return safeReply(interaction, "❌ Seul le staff peut prendre un ticket.");
  }

  const claimedMatch = channel.topic?.match(/ticketClaimed=(\d+)/);

  if (claimedMatch) {
    return safeReply(
      interaction,
      `⚠️ Ce ticket est déjà pris en charge par <@${claimedMatch[1]}>.`
    );
  }

  try {
    await channel.setTopic(
      setTicketTopicValue(channel.topic, "ticketClaimed", interaction.user.id)
    );

    await interaction.reply({
      content: `✅ Ticket pris en charge par ${interaction.user}.`,
    });

    await sendLog(
      interaction.guild,
      "🙋 Ticket pris en charge",
      `**Salon :** ${channel}\n**Staff :** ${interaction.user.tag}`
    );
  } catch (error) {
    console.error("Erreur de prise en charge :", error.message);

    return safeReply(
      interaction,
      "❌ Impossible de prendre ce ticket en charge."
    );
  }
}

async function unclaimTicket(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    return safeReply(interaction, "❌ Ce salon n'est pas un ticket.");
  }

  if (!isStaff(interaction.member)) {
    return safeReply(interaction, "❌ Seul le staff peut libérer un ticket.");
  }

  const claimedMatch = channel.topic?.match(/ticketClaimed=(\d+)/);

  if (!claimedMatch) {
    return safeReply(interaction, "ℹ️ Ce ticket n'est pas pris en charge.");
  }

  if (
    claimedMatch[1] !== interaction.user.id &&
    !isOwner(interaction.user.id) &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    return safeReply(
      interaction,
      "❌ Seul le responsable du ticket ou un administrateur peut le libérer."
    );
  }

  const newTopic = (channel.topic || "")
    .split(";")
    .filter(Boolean)
    .filter((part) => !part.startsWith("ticketClaimed="))
    .join(";");

  try {
    await channel.setTopic(newTopic);

    await interaction.reply({
      content: `↩️ Le ticket a été libéré par ${interaction.user}.`,
    });

    await sendLog(
      interaction.guild,
      "↩️ Ticket libéré",
      `**Salon :** ${channel}\n**Staff :** ${interaction.user.tag}`
    );
  } catch (error) {
    console.error("Erreur de libération :", error.message);

    return safeReply(interaction, "❌ Impossible de libérer ce ticket.");
  }
}

async function closeTicket(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    return safeReply(interaction, "❌ Ce salon n'est pas un ticket.");
  }

  const ownerId = getTicketOwnerId(channel);
  const staff = isStaff(interaction.member);

  if (interaction.user.id !== ownerId && !staff) {
    return safeReply(
      interaction,
      "❌ Seul le créateur du ticket ou le staff peut le fermer."
    );
  }

  await interaction.reply({
    content: "🔒 Fermeture du ticket dans quelques secondes…",
  });

  await sendLog(
    interaction.guild,
    "🔒 Ticket fermé",
    [
      `**Salon :** #${channel.name}`,
      `**Créateur :** ${ownerId ? `<@${ownerId}>` : "Inconnu"}`,
      `**Fermé par :** ${interaction.user.tag}`,
      `**Catégorie :** ${getCategoryName(getTicketCategoryId(channel))}`,
    ].join("\n"),
    "#ED4245"
  );

  try {
    await channel.setTopic(
      setTicketTopicValue(channel.topic || "", "ticketOpen", "false")
    );
  } catch {
    // On tente tout de même de supprimer le salon.
  }

  setTimeout(async () => {
    try {
      await channel.delete(`Ticket fermé par ${interaction.user.tag}`);
    } catch (error) {
      console.error("Suppression du ticket impossible :", error.message);
    }
  }, 3000);
}

// ============================================================
// PANEL ADMINISTRATEUR
// ============================================================

function adminEmbed() {
  const categories = config.categories.length
    ? config.categories
        .map(
          (category, index) =>
            `${index + 1}. ${getEmojiMarkup(category.emoji)} **${category.name}**`
        )
        .join("\n")
    : "Aucune catégorie configurée.";

  return new EmbedBuilder()
    .setColor(colorNumber())
    .setTitle("⚙️・Administration Neyvo Ticket")
    .setDescription(
      [
        "Configure ton panel de tickets depuis ce menu.",
        "",
        `**Titre :** ${config.panelTitle}`,
        `**Description :** ${config.panelDescription.slice(0, 250)}${
          config.panelDescription.length > 250 ? "…" : ""
        }`,
        `**Couleur :** \`${config.panelColor}\``,
        `**Style :** ${
          config.panelStyle === "buttons" ? "Boutons" : "Menu déroulant"
        }`,
        `**Rôle staff :** ${
          config.staffRoleId ? `<@&${config.staffRoleId}>` : "Non défini"
        }`,
        `**Salon logs :** ${
          config.logChannelId ? `<#${config.logChannelId}>` : "Non défini"
        }`,
        `**Catégorie Discord des tickets :** ${
          config.ticketCategoryId
            ? `<#${config.ticketCategoryId}>`
            : "Non définie"
        }`,
        `**Salon du panel :** ${
          config.panelChannelId ? `<#${config.panelChannelId}>` : "Non défini"
        }`,
        "",
        "**Catégories :**",
        categories,
      ].join("\n")
    )
    .setFooter({ text: "Neyvo Ticket • Configuration" })
    .setTimestamp();
}

function adminComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_style")
      .setLabel("Type de panel")
      .setEmoji("🧩")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_title")
      .setLabel("Titre")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_description")
      .setLabel("Description")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_color")
      .setLabel("Couleur")
      .setEmoji("🎨")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_categories")
      .setLabel("Catégories")
      .setEmoji("📂")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_staffrole")
      .setLabel("Rôle staff")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_logchannel")
      .setLabel("Salon logs")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_panelchannel")
      .setLabel("Salon panel")
      .setEmoji("📨")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_preview")
      .setLabel("Aperçu")
      .setEmoji("👁️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("admin_publish")
      .setLabel("Publier")
      .setEmoji("🚀")
      .setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_refresh")
      .setLabel("Actualiser le panel")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_close")
      .setLabel("Fermer")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

async function refreshAdminMessage(interaction) {
  try {
    await interaction.message.edit({
      embeds: [adminEmbed()],
      components: adminComponents(),
    });
  } catch (error) {
    console.error("Actualisation du menu admin impossible :", error.message);
  }
}

function buildModal(customId, title, fields) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title.slice(0, 45));

  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label.slice(0, 45))
      .setStyle(field.style || TextInputStyle.Short)
      .setRequired(field.required ?? true);

    if (field.placeholder) {
      input.setPlaceholder(field.placeholder.slice(0, 100));
    }

    if (field.value !== undefined && field.value !== null) {
      input.setValue(String(field.value).slice(0, field.maxLength || 4000));
    }

    if (field.maxLength) input.setMaxLength(field.maxLength);
    if (field.minLength) input.setMinLength(field.minLength);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

function categoriesManagerPayload() {
  const embed = new EmbedBuilder()
    .setColor(colorNumber())
    .setTitle("📂・Gestion des catégories")
    .setDescription(
      [
        "Choisis une catégorie pour la modifier ou la supprimer.",
        "",
        ...config.categories.map(
          (category, index) =>
            `**${index + 1}.** ${getEmojiMarkup(category.emoji)} ${category.name}`
        ),
        "",
        "Pour les emojis personnalisés, utilise le format `<:nom:ID>` ou `<a:nom:ID>`.",
      ].join("\n")
    );

  const rows = [];

  if (config.categories.length) {
    const options = config.categories.slice(0, 25).map((category) => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(category.name.slice(0, 100))
        .setValue(category.id);

      setSafeEmoji(option, category.emoji);

      return option;
    });

    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("admin_category_select")
          .setPlaceholder("Choisis une catégorie à gérer")
          .addOptions(options)
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_category_add")
        .setLabel("Ajouter une catégorie")
        .setEmoji("➕")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("admin_category_back")
        .setLabel("Retour")
        .setEmoji("↩️")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components: rows };
}

function categoryActionPayload(category) {
  const embed = new EmbedBuilder()
    .setColor(colorNumber())
    .setTitle("🛠️・Modifier une catégorie")
    .setDescription(
      [
        `**Nom :** ${category.name}`,
        `**Emoji :** ${getEmojiMarkup(category.emoji)}`,
        "",
        "Tu peux modifier cette catégorie ou la supprimer.",
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_category_edit:${category.id}`)
      .setLabel("Modifier")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`admin_category_delete:${category.id}`)
      .setLabel("Supprimer")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("admin_category_back")
      .setLabel("Retour")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ============================================================
// OWNERS — AFFICHAGE
// ============================================================

async function showOwners(interaction) {
  if (!isOwner(interaction.user.id)) {
    return safeReply(interaction, "❌ Cette commande est réservée aux owners.");
  }

  const list = [...owners]
    .map((id, index) => `**${index + 1}.** <@${id}> — \`${id}\``)
    .join("\n");

  return safeReply(
    interaction,
    `👑 **Owners Neyvo Ticket**\n\n${list || "Aucun owner enregistré."}`
  );
}

// ============================================================
// STATUT ET ACTIVITÉ DU BOT
// ============================================================

function activityTypeFromString(value) {
  const normalized = safeText(value).toLowerCase();

  const types = {
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    competing: ActivityType.Competing,
    streaming: ActivityType.Streaming,
  };

  return types[normalized] ?? ActivityType.Playing;
}

async function applyPresence(status) {
  const allowedStatuses = ["online", "idle", "dnd", "invisible"];
  const normalized = allowedStatuses.includes(status) ? status : "online";

  client.user.setStatus(normalized);
}

async function applyActivity(type, textValue, url) {
  const typeId = activityTypeFromString(type);

  const activityOptions = {
    name: safeText(textValue, "Neyvo Ticket").slice(0, 128),
    type: typeId,
  };

  if (
    typeId === ActivityType.Streaming &&
    typeof url === "string" &&
    /^https?:\/\//i.test(url)
  ) {
    activityOptions.url = url;
  }

  client.user.setActivity(activityOptions);
}

// ============================================================
// INTERACTIONS DISCORD
// ============================================================

client.on("interactionCreate", async (interaction) => {
  try {
    // --------------------------------------------------------
    // COMMANDES SLASH
    // --------------------------------------------------------

    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      if (command === "help") {
        const embed = new EmbedBuilder()
          .setColor(colorNumber())
          .setTitle("📚・Aide — Neyvo Ticket")
          .setDescription(
            "Voici les commandes disponibles. Certaines nécessitent des permissions particulières."
          )
          .addFields({
            name: "🎫・Tickets",
            value: [
              "`/help` — Afficher cette aide",
              "`/close` — Fermer un ticket",
            ].join("\n"),
            inline: false,
          });

        if (isStaff(interaction.member)) {
          embed.addFields({
            name: "🛡️・Staff",
            value: [
              "`/ticketpanel` — Publier le panel de tickets",
              "`/adminpanel` — Ouvrir le panel de configuration",
              "`/claim` — Prendre un ticket en charge",
              "`/unclaim` — Libérer un ticket",
              "`/rename nom` — Renommer un ticket",
              "`/adduser utilisateur` — Donner accès au ticket",
              "`/removeuser utilisateur` — Retirer l'accès au ticket",
              "`/setstaffrole role` — Configurer le rôle staff",
              "`/setlogchannel salon` — Configurer les logs",
              "`/setticketcategory categorie` — Choisir la catégorie Discord des tickets",
            ].join("\n"),
            inline: false,
          });
        }

        if (isOwner(interaction.user.id)) {
          embed.addFields({
            name: "👑・Owner",
            value: [
              "`/addowner utilisateur` — Ajouter un owner",
              "`/removeowner utilisateur` — Retirer un owner",
              "`/listowners` — Afficher les owners",
              "`/status statut` — Changer le statut du bot",
              "`/stream texte lien` — Configurer le streaming",
              "`/activity type texte lien` — Modifier l'activité",
            ].join("\n"),
            inline: false,
          });
        }

        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      if (command === "adminpanel") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas accès au panel administrateur."
          );
        }

        return interaction.reply({
          embeds: [adminEmbed()],
          components: adminComponents(),
          ephemeral: true,
        });
      }

      if (command === "ticketpanel") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas la permission de publier le panel."
          );
        }

        try {
          const message = await publishPublicPanel(interaction.channel, false);

          return safeReply(
            interaction,
            `✅ Panel publié dans ${message.channel}.`
          );
        } catch (error) {
          console.error("Publication du panel impossible :", error.message);

          return safeReply(
            interaction,
            "❌ Impossible de publier le panel. Vérifie les permissions du bot."
          );
        }
      }

      if (command === "addowner") {
        if (!isOwner(interaction.user.id)) {
          return safeReply(interaction, "❌ Seul un owner peut ajouter un owner.");
        }

        const user = interaction.options.getUser("utilisateur", true);

        owners.add(user.id);
        saveOwners();

        return safeReply(
          interaction,
          `✅ ${user} est maintenant owner de Neyvo Ticket.`
        );
      }

      if (command === "removeowner") {
        if (!isOwner(interaction.user.id)) {
          return safeReply(interaction, "❌ Seul un owner peut retirer un owner.");
        }

        const user = interaction.options.getUser("utilisateur", true);

        if (user.id === interaction.user.id) {
          return safeReply(
            interaction,
            "❌ Tu ne peux pas te retirer toi-même des owners."
          );
        }

        owners.delete(user.id);
        saveOwners();

        return safeReply(
          interaction,
          `✅ ${user} n'est plus owner de Neyvo Ticket.`
        );
      }

      if (command === "listowners") {
        return showOwners(interaction);
      }

      if (command === "setstaffrole") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas la permission de configurer le rôle staff."
          );
        }

        const role = interaction.options.getRole("role", true);

        config.staffRoleId = role.id;
        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(interaction, `✅ Rôle staff défini sur ${role}.`);
      }

      if (command === "setlogchannel") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas la permission de configurer les logs."
          );
        }

        const channel = interaction.options.getChannel("salon", true);

        if (!channel.isTextBased()) {
          return safeReply(interaction, "❌ Choisis un salon textuel.");
        }

        config.logChannelId = channel.id;
        saveConfig();

        return safeReply(interaction, `✅ Salon de logs défini sur ${channel}.`);
      }

      // NOUVELLE COMMANDE : CONFIGURER LA CATÉGORIE DISCORD DES TICKETS
      if (command === "setticketcategory") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas la permission de configurer la catégorie des tickets."
          );
        }

        const category = interaction.options.getChannel("categorie", true);

        if (category.type !== ChannelType.GuildCategory) {
          return safeReply(
            interaction,
            "❌ Tu dois sélectionner une catégorie Discord, pas un salon."
          );
        }

        config.ticketCategoryId = category.id;
        saveConfig();

        return safeReply(
          interaction,
          `✅ Les nouveaux tickets seront créés dans la catégorie **${category.name}**.`
        );
      }

      if (command === "claim") return claimTicket(interaction);
      if (command === "unclaim") return unclaimTicket(interaction);
      if (command === "close") return closeTicket(interaction);

      if (command === "rename") {
        try {
          if (!isTicketChannel(interaction.channel)) {
            return safeReply(
              interaction,
              "❌ Cette commande doit être utilisée dans un ticket."
            );
          }

          if (!isStaff(interaction.member)) {
            return safeReply(
              interaction,
              "❌ Seul le staff peut renommer un ticket."
            );
          }

          const name = interaction.options.getString("nom", true).trim();

          if (!name) {
            return safeReply(interaction, "❌ Le nom ne peut pas être vide.");
          }

          const newName = slugify(name);

          if (!newName || newName.length < 1) {
            return safeReply(interaction, "❌ Ce nom n'est pas valide.");
          }

          await interaction.channel.setName(newName);

          return safeReply(
            interaction,
            `✅ Ticket renommé en **${newName}**.`
          );
        } catch (error) {
          console.error("Erreur /rename :", error);

          if (interaction.deferred) {
            return interaction.editReply(
              "❌ Impossible de renommer ce ticket. Vérifie les permissions du bot."
            ).catch(() => {});
          }

          if (!interaction.replied) {
            return safeReply(
              interaction,
              "❌ Une erreur est survenue pendant le renommage."
            ).catch(() => {});
          }
        }
      }

      if (command === "adduser") {
        if (!isTicketChannel(interaction.channel)) {
          return safeReply(
            interaction,
            "❌ Cette commande doit être utilisée dans un ticket."
          );
        }

        if (!isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Seul le staff peut ajouter un utilisateur.");
        }

        const user = interaction.options.getUser("utilisateur", true);

        try {
          await interaction.channel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
          });

          return safeReply(interaction, `✅ ${user} a été ajouté au ticket.`);
        } catch (error) {
          console.error("Erreur d'ajout d'utilisateur :", error.message);

          return safeReply(interaction, "❌ Impossible d'ajouter cet utilisateur.");
        }
      }

      if (command === "removeuser") {
        if (!isTicketChannel(interaction.channel)) {
          return safeReply(
            interaction,
            "❌ Cette commande doit être utilisée dans un ticket."
          );
        }

        if (!isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Seul le staff peut retirer un utilisateur.");
        }

        const user = interaction.options.getUser("utilisateur", true);
        const ownerId = getTicketOwnerId(interaction.channel);

        if (user.id === ownerId) {
          return safeReply(
            interaction,
            "❌ Tu ne peux pas retirer le créateur du ticket. Ferme le ticket si nécessaire."
          );
        }

        try {
          await interaction.channel.permissionOverwrites.delete(user.id);

          return safeReply(interaction, `✅ ${user} a été retiré du ticket.`);
        } catch (error) {
          console.error("Erreur de retrait d'utilisateur :", error.message);

          return safeReply(interaction, "❌ Impossible de retirer cet utilisateur.");
        }
      }

      if (command === "status") {
        if (!isOwner(interaction.user.id)) {
          return safeReply(
            interaction,
            "❌ Seul un owner peut changer le statut du bot."
          );
        }

        const status = interaction.options.getString("statut", true);

        try {
          await applyPresence(status);

          return safeReply(
            interaction,
            `✅ Statut du bot changé en **${status}**.`
          );
        } catch (error) {
          console.error("Erreur de changement de statut :", error.message);

          return safeReply(interaction, "❌ Impossible de modifier le statut.");
        }
      }

      if (command === "stream") {
        if (!isOwner(interaction.user.id)) {
          return safeReply(
            interaction,
            "❌ Seul un owner peut modifier le streaming."
          );
        }

        const textValue = interaction.options.getString("texte", true);
        const url = interaction.options.getString("lien", true);

        if (!/^https?:\/\//i.test(url)) {
          return safeReply(
            interaction,
            "❌ Le lien doit commencer par `http://` ou `https://`."
          );
        }

        try {
          await applyActivity("Streaming", textValue, url);

          return safeReply(interaction, "✅ Activité de streaming mise à jour.");
        } catch (error) {
          console.error("Erreur de streaming :", error.message);

          return safeReply(interaction, "❌ Impossible de modifier l'activité.");
        }
      }

      if (command === "activity") {
        if (!isOwner(interaction.user.id)) {
          return safeReply(
            interaction,
            "❌ Seul un owner peut modifier l'activité."
          );
        }

        const type = interaction.options.getString("type", true);
        const textValue = interaction.options.getString("texte", true);
        const url = interaction.options.getString("lien");

        if (
          type.toLowerCase() === "streaming" &&
          (!url || !/^https?:\/\//i.test(url))
        ) {
          return safeReply(
            interaction,
            "❌ Pour une activité Streaming, ajoute un lien valide commençant par `http://` ou `https://`."
          );
        }

        try {
          await applyActivity(type, textValue, url);

          return safeReply(
            interaction,
            `✅ Activité du bot mise à jour : **${type} ${textValue}**.`
          );
        } catch (error) {
          console.error("Erreur de changement d'activité :", error.message);

          return safeReply(interaction, "❌ Impossible de modifier l'activité.");
        }
      }

      return;
    }

    // --------------------------------------------------------
    // MENU DU PANEL PUBLIC
    // --------------------------------------------------------

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_category_select"
    ) {
      return createTicket(interaction, interaction.values[0]);
    }

    // --------------------------------------------------------
    // MENU DE SÉLECTION DES CATÉGORIES ADMIN
    // --------------------------------------------------------

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "admin_category_select"
    ) {
      if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Tu n'as pas accès à cette configuration.");
      }

      const category = getCategory(interaction.values[0]);

      if (!category) {
        return safeReply(interaction, "❌ Catégorie introuvable.");
      }

      return interaction.update(categoryActionPayload(category));
    }

    // --------------------------------------------------------
    // BOUTONS
    // --------------------------------------------------------

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("ticket_create:")) {
        return createTicket(interaction, id.split(":")[1]);
      }

      if (id === "ticket_claim") return claimTicket(interaction);
      if (id === "ticket_unclaim") return unclaimTicket(interaction);
      if (id === "ticket_close") return closeTicket(interaction);

      if (id.startsWith("admin_category_edit:")) {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Accès refusé.");
        }

        const category = getCategory(id.split(":")[1]);

        if (!category) {
          return safeReply(interaction, "❌ Catégorie introuvable.");
        }

        return interaction.showModal(
          buildModal("admin_category_edit_modal", "Modifier une catégorie", [
            {
              id: "category_id",
              label: "Identifiant de la catégorie",
              value: category.id,
              maxLength: 100,
            },
            {
              id: "category_name",
              label: "Nom de la catégorie",
              value: category.name,
              maxLength: 100,
            },
            {
              id: "category_emoji",
              label: "Emoji (Unicode ou <:nom:ID>)",
              value: category.emoji,
              maxLength: 100,
            },
          ])
        );
      }

      if (id.startsWith("admin_category_delete:")) {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Accès refusé.");
        }

        const categoryId = id.split(":")[1];

        if (!getCategory(categoryId)) {
          return safeReply(interaction, "❌ Catégorie introuvable.");
        }

        config.categories = config.categories.filter(
          (category) => category.id !== categoryId
        );

        if (!config.categories.length) {
          config.categories = structuredClone(DEFAULT_CATEGORIES);
        }

        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return interaction.update(categoriesManagerPayload());
      }

      if (id === "admin_category_add") {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Accès refusé.");
        }

        if (config.categories.length >= 25) {
          return safeReply(
            interaction,
            "❌ Discord autorise au maximum 25 catégories dans ce panel."
          );
        }

        return interaction.showModal(
          buildModal("admin_category_add_modal", "Ajouter une catégorie", [
            {
              id: "category_name",
              label: "Nom de la catégorie",
              placeholder: "Exemple : Support général",
              maxLength: 100,
            },
            {
              id: "category_emoji",
              label: "Emoji (Unicode ou <:nom:ID>)",
              placeholder: "🎫 ou <:nom:123456789012345678>",
              maxLength: 100,
            },
          ])
        );
      }

      if (id === "admin_category_back") {
        return interaction.update({
          embeds: [adminEmbed()],
          components: adminComponents(),
        });
      }

      if (id.startsWith("admin_")) {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Tu n'as pas accès au panel administrateur."
          );
        }
      }

      if (id === "admin_style") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("admin_style_dropdown")
            .setLabel("Menu déroulant")
            .setEmoji("📋")
            .setStyle(
              config.panelStyle === "dropdown"
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("admin_style_buttons")
            .setLabel("Boutons")
            .setEmoji("🔘")
            .setStyle(
              config.panelStyle === "buttons"
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("admin_style_back")
            .setLabel("Retour")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: "Choisis le type d'affichage du panel public :",
          components: [row],
          ephemeral: true,
        });
      }

      if (id === "admin_style_dropdown" || id === "admin_style_buttons") {
        config.panelStyle = id === "admin_style_buttons" ? "buttons" : "dropdown";

        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return interaction.update({
          content: `✅ Style du panel : **${
            config.panelStyle === "buttons" ? "Boutons" : "Menu déroulant"
          }**.`,
          components: [],
        });
      }

      if (id === "admin_style_back") {
        return interaction.update({
          content: "Configuration du style annulée.",
          components: [],
        });
      }

      if (id === "admin_title") {
        return interaction.showModal(
          buildModal("admin_title_modal", "Modifier le titre", [
            {
              id: "panel_title",
              label: "Titre du panel",
              value: config.panelTitle,
              maxLength: 256,
            },
          ])
        );
      }

      if (id === "admin_description") {
        return interaction.showModal(
          buildModal("admin_description_modal", "Modifier la description", [
            {
              id: "panel_description",
              label: "Description du panel",
              value: config.panelDescription,
              style: TextInputStyle.Paragraph,
              maxLength: 4000,
            },
          ])
        );
      }

      if (id === "admin_color") {
        return interaction.showModal(
          buildModal("admin_color_modal", "Modifier la couleur", [
            {
              id: "panel_color",
              label: "Couleur hexadécimale",
              value: config.panelColor,
              placeholder: "#5865F2",
              maxLength: 7,
            },
          ])
        );
      }

      if (id === "admin_categories") {
        return interaction.reply({
          ...categoriesManagerPayload(),
          ephemeral: true,
        });
      }

      if (id === "admin_staffrole") {
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId("admin_staffrole_select")
          .setPlaceholder("Choisis le rôle staff");

        return interaction.reply({
          content: `Rôle actuel : ${
            config.staffRoleId ? `<@&${config.staffRoleId}>` : "Non défini"
          }`,
          components: [
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("admin_staffrole_remove")
                .setLabel("Retirer le rôle staff")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
          ephemeral: true,
        });
      }

      if (id === "admin_staffrole_remove") {
        config.staffRoleId = null;
        saveConfig();

        return interaction.update({
          content: "✅ Le rôle staff a été retiré.",
          components: [],
        });
      }

      if (id === "admin_logchannel") {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId("admin_logchannel_select")
          .setPlaceholder("Choisis le salon des logs")
          .setChannelTypes(ChannelType.GuildText);

        return interaction.reply({
          content: `Salon actuel : ${
            config.logChannelId ? `<#${config.logChannelId}>` : "Non défini"
          }`,
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("admin_logchannel_remove")
                .setLabel("Retirer le salon logs")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
          ephemeral: true,
        });
      }

      if (id === "admin_logchannel_remove") {
        config.logChannelId = null;
        saveConfig();

        return interaction.update({
          content: "✅ Le salon de logs a été retiré.",
          components: [],
        });
      }

      if (id === "admin_panelchannel") {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId("admin_panelchannel_select")
          .setPlaceholder("Choisis le salon du panel")
          .setChannelTypes(ChannelType.GuildText);

        return interaction.reply({
          content: `Salon actuel : ${
            config.panelChannelId ? `<#${config.panelChannelId}>` : "Non défini"
          }`,
          components: [new ActionRowBuilder().addComponents(channelSelect)],
          ephemeral: true,
        });
      }

      if (id === "admin_preview") {
        return interaction.reply({
          content: "👁️ **Aperçu du panel public :**",
          embeds: [buildPublicPanelEmbed()],
          components: buildPublicPanelComponents(),
          ephemeral: true,
        });
      }

      if (id === "admin_publish") {
        let channel = null;

        if (config.panelChannelId) {
          channel = await getTextChannel(
            interaction.guild,
            config.panelChannelId
          );
        }

        if (!channel) channel = interaction.channel;

        try {
          await publishPublicPanel(channel, false);

          return safeReply(
            interaction,
            `✅ Panel public publié dans ${channel}.`
          );
        } catch (error) {
          console.error("Erreur de publication :", error.message);

          return safeReply(
            interaction,
            "❌ Impossible de publier le panel. Vérifie les permissions du bot."
          );
        }
      }

      if (id === "admin_refresh") {
        const refreshed = await refreshPublishedPanel(interaction.guild);

        if (!refreshed) {
          return safeReply(
            interaction,
            "⚠️ Aucun panel existant n'a pu être actualisé. Utilise Publier pour en créer un."
          );
        }

        await refreshAdminMessage(interaction);

        return safeReply(interaction, "✅ Panel public actualisé.");
      }

      if (id === "admin_close") {
        return interaction.update({
          content: "✅ Menu administrateur fermé.",
          embeds: [],
          components: [],
        });
      }
    }

    // --------------------------------------------------------
    // SÉLECTEURS DE RÔLE ET DE SALON
    // --------------------------------------------------------

    if (
      interaction.isRoleSelectMenu() &&
      interaction.customId === "admin_staffrole_select"
    ) {
      if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Accès refusé.");
      }

      config.staffRoleId = interaction.values[0];
      saveConfig();

      await refreshPublishedPanel(interaction.guild);

      return interaction.update({
        content: `✅ Rôle staff défini sur <@&${config.staffRoleId}>.`,
        components: [],
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "admin_logchannel_select"
    ) {
      if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Accès refusé.");
      }

      config.logChannelId = interaction.values[0];
      saveConfig();

      return interaction.update({
        content: `✅ Salon de logs défini sur <#${config.logChannelId}>.`,
        components: [],
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "admin_panelchannel_select"
    ) {
      if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Accès refusé.");
      }

      config.panelChannelId = interaction.values[0];
      saveConfig();

      return interaction.update({
        content:
          `✅ Salon du panel défini sur <#${config.panelChannelId}>.\n` +
          "Clique sur **Publier** dans le panel administrateur pour publier le panel dans ce salon.",
        components: [],
      });
    }

    // --------------------------------------------------------
    // MODALS
    // --------------------------------------------------------

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      if (id.startsWith("admin_")) {
        if (!isOwner(interaction.user.id) && !isStaff(interaction.member)) {
          return safeReply(interaction, "❌ Accès refusé.");
        }
      }

      if (id === "admin_title_modal") {
        const value = interaction.fields
          .getTextInputValue("panel_title")
          .trim();

        if (!value) {
          return safeReply(interaction, "❌ Le titre ne peut pas être vide.");
        }

        config.panelTitle = value.slice(0, 256);
        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(interaction, "✅ Titre du panel mis à jour.");
      }

      if (id === "admin_description_modal") {
        const value = interaction.fields
          .getTextInputValue("panel_description")
          .trim();

        if (!value) {
          return safeReply(
            interaction,
            "❌ La description ne peut pas être vide."
          );
        }

        config.panelDescription = value.slice(0, 4000);
        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(interaction, "✅ Description du panel mise à jour.");
      }

      if (id === "admin_color_modal") {
        const value = interaction.fields
          .getTextInputValue("panel_color")
          .trim();

        if (!/^#?[0-9a-fA-F]{6}$/.test(value)) {
          return safeReply(
            interaction,
            "❌ Couleur invalide. Utilise un code hexadécimal comme `#5865F2`."
          );
        }

        config.panelColor = normalizeColor(value);
        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(
          interaction,
          `✅ Couleur mise à jour : ${config.panelColor}`
        );
      }

      if (id === "admin_category_add_modal") {
        const name = interaction.fields
          .getTextInputValue("category_name")
          .trim();

        const emojiValue =
          interaction.fields.getTextInputValue("category_emoji").trim() ||
          "🎫";

        if (!name) {
          return safeReply(
            interaction,
            "❌ Le nom de la catégorie est obligatoire."
          );
        }

        if (config.categories.length >= 25) {
          return safeReply(
            interaction,
            "❌ Le panel ne peut pas contenir plus de 25 catégories."
          );
        }

        const category = normalizeCategory({
          id: makeId(),
          name,
          emoji: emojiValue,
        });

        config.categories.push(category);
        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(
          interaction,
          `✅ Catégorie ajoutée : ${getEmojiMarkup(category.emoji)} **${category.name}**`
        );
      }

      if (id === "admin_category_edit_modal") {
        const categoryId = interaction.fields
          .getTextInputValue("category_id")
          .trim();

        const name = interaction.fields
          .getTextInputValue("category_name")
          .trim();

        const emojiValue =
          interaction.fields.getTextInputValue("category_emoji").trim() ||
          "🎫";

        const category = getCategory(categoryId);

        if (!category) {
          return safeReply(interaction, "❌ Catégorie introuvable.");
        }

        if (!name) {
          return safeReply(
            interaction,
            "❌ Le nom de la catégorie est obligatoire."
          );
        }

        category.name = name.slice(0, 100);
        category.emoji = emojiValue.slice(0, 100);

        saveConfig();

        await refreshPublishedPanel(interaction.guild);

        return safeReply(
          interaction,
          `✅ Catégorie modifiée : ${getEmojiMarkup(category.emoji)} **${category.name}**`
        );
      }
    }
  } catch (error) {
    console.error("Erreur interaction Neyvo Ticket :", error);

    if (interaction.isRepliable()) {
      await safeReply(
        interaction,
        "❌ Une erreur est survenue. Vérifie la console du bot pour plus de détails."
      );
    }
  }
});

// ============================================================
// DÉMARRAGE
// ============================================================

client.once("ready", async () => {
  saveOwners();

  console.log("========================================");
  console.log(`✅ ${client.user.tag} est connecté !`);
  console.log(`🛡️ Owners : ${owners.size}`);
  console.log(`📂 Catégories : ${config.categories.length}`);
  console.log(`🎨 Style du panel : ${config.panelStyle}`);
  console.log(
    `📁 Catégorie Discord des tickets : ${config.ticketCategoryId || "Non définie"}`
  );
  console.log("========================================");

  try {
    const guildId = config.guildId || process.env.GUILD_ID;

    if (guildId && config.panelChannelId && config.panelMessageId) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);

      if (guild) {
        const refreshed = await refreshPublishedPanel(guild);

        if (refreshed) {
          console.log("🔄 Panel public actualisé au démarrage.");
        }
      }
    }
  } catch (error) {
    console.error(
      "Erreur pendant l'actualisation au démarrage :",
      error.message
    );
  }
});

client.on("error", (error) => {
  console.error("Erreur client Discord :", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée :", error);
});

// ============================================================
// CONNEXION
// ============================================================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN absent du fichier .env.");
  process.exit(1);
}

client.login(process.env.TOKEN).catch((error) => {
  console.error("❌ Connexion Discord impossible :", error);
});