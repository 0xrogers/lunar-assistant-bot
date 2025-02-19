import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { LunarAssistant } from "..";
import db from "../services/admin";

export default {
  data: new SlashCommandBuilder()
    .setName("lunar-configure")
    .setDescription("Configures the lunar assistant")
    .setDefaultPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add-rule")
        .setDescription("Adds a rule for granting a role to users.")
        .addStringOption((option) =>
          option
            .setName("nft-address")
            .setDescription(
              "The contract address against which to check for nft ownership for this rule."
            )
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role to give to users which meet this rule.")
            .setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName("quantity")
            .setDescription(
              "The quantity of matching nfts that a user must hold in order to meet the rule.  "
            )
        )
        .addStringOption((option) =>
          option
            .setName("token-ids")
            .setDescription(
              "A list of token ids that the rule is restricted to."
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view-rules")
        .setDescription("View the rules currently configured for the server.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove-rule")
        .setDescription(
          "Remove a rule based on its index in the output of `/list-rules`"
        )
        .addNumberOption((option) =>
          option
            .setName("rule-number")
            .setDescription("The index of the rule to remove.")
            .setRequired(true)
        )
    ),
  execute: async (
    lunarAssistant: LunarAssistant,
    interaction: CommandInteraction
  ) => {
    // verify the interaction is valid
    if (!interaction.guildId || !interaction.guild || !interaction.member)
      return;

    if (interaction.options.getSubcommand() === "add-rule") {
      // configure the server settings
      const nftAddress = interaction.options.getString("nft-address");
      const role = interaction.options.getRole("role");
      const rawQuantity = interaction.options.getNumber("quantity");
      const rawTokenIds = interaction.options.getString("token-ids");

      // verify that nftAddress and role are defined
      if (!nftAddress || !role) {
        await interaction.reply("Could not get nftAddress or role");
        return;
      }

      // verify that we can parse tokenIds
      let tokenIds;
      try {
        tokenIds = rawTokenIds ? JSON.parse(rawTokenIds) : undefined;
      } catch {
        await interaction.reply("Could not parse token ids");
        return;
      }

      const quantity = rawQuantity ? rawQuantity : 1;

      // check if the bot role is above the verified role
      const lunarAssistantRole = interaction.guild.roles.cache.find(
        (role) => role.name == "Lunar Assistant"
      )!;

      if (role.position > lunarAssistantRole.position) {
        await interaction.reply({
          content: `Please update the role hierarchy with 'Lunar Assistant' above of ${role.name} and try again.`,
          ephemeral: true,
        });
        return;
      }

      const newRule: GuildRule = {
        version: "1.0",
        nft: {
          [nftAddress]: {
            // only include tokenIds if defined
            ...(tokenIds && { tokenIds }),
            quantity,
          },
        },
        token: {},
        nativeToken: {},
        roleName: role.name,
      };

      const guildConfigDoc = await db
        .collection("guildConfigs")
        .doc(interaction.guildId)
        .get();

      const guildConfig: GuildConfig = guildConfigDoc.exists
        ? (guildConfigDoc.data() as GuildConfig)
        : { rules: [] };

      guildConfig.rules.push(newRule);

      // update the db
      await db
        .collection("guildConfigs")
        .doc(interaction.guildId)
        .set(guildConfig);

      // reply
      await interaction.reply({
        content: "Rule added successfully!",
        ephemeral: true,
      });
    } else if (interaction.options.getSubcommand() === "view-rules") {
      const guildConfigDoc = await db
        .collection("guildConfigs")
        .doc(interaction.guildId)
        .get();

      if (!guildConfigDoc.exists) {
        await interaction.reply({
          content:
            "You haven't created any rules yet. Please run `/rule-add` and try again",
          ephemeral: true,
        });
        return;
      }

      const guildConfigRules = (guildConfigDoc.data() as GuildConfig).rules;

      const rulesMessage = guildConfigRules
        .map((guildRule, index) => {
          const nftAddresses = Object.keys(guildRule.nft);
          if (nftAddresses.length !== 1) return;
          const nftAddress = nftAddresses[0];
          const tokenIds = guildRule.nft[nftAddress].tokenIds;
          const nftRule: NFTRule = {
            nftAddress,
            ...(tokenIds && { tokenIds }),
            quantity: guildRule.nft[nftAddress].quantity,
            roleName: guildRule.roleName,
          };

          return `Rule ${index}: ${JSON.stringify(nftRule)}`;
        })
        .join("\n");

      // reply with list of configured rules
      await interaction.reply({
        content: "Your configured rules:\n" + rulesMessage,
        ephemeral: true,
      });
    } else if (interaction.options.getSubcommand() === "remove-rule") {
      const ruleNumber = interaction.options.getNumber("rule-number");

      if (ruleNumber == undefined) {
        await interaction.reply({
          content: "Please specify a rule number and try again",
          ephemeral: true,
        });
        return;
      }

      const guildConfigDoc = await db
        .collection("guildConfigs")
        .doc(interaction.guildId)
        .get();

      if (!guildConfigDoc.exists) {
        await interaction.reply({
          content:
            "You haven't created any rules yet. Please run `/rule-add` and try again",
          ephemeral: true,
        });
        return;
      }

      // configure guild config
      const guildConfig = guildConfigDoc.data() as GuildConfig;

      if (guildConfig.rules.length <= ruleNumber) {
        await interaction.reply({
          content: `Rule number is out of bounds. Please enter a rule number in the range 0-${
            guildConfig.rules.length - 1
          }`,
          ephemeral: true,
        });
        return;
      }

      guildConfig.rules.splice(ruleNumber, 1);

      // update the db
      await db
        .collection("guildConfigs")
        .doc(interaction.guildId)
        .set(guildConfig);

      // reply
      await interaction.reply({
        content: "Rule removed successfully!",
        ephemeral: true,
      });
    }
  },
};
