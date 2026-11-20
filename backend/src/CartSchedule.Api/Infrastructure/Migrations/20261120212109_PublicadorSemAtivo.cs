using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PublicadorSemAtivo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ADR 0002: quem estava desativado volta como conta sem PIN e desconectada — não
            // entra até o administrador definir um PIN. Nada é apagado.
            migrationBuilder.Sql(
                """
                UPDATE publicadores
                SET "PinHash" = NULL, "VersaoSessao" = "VersaoSessao" + 1
                WHERE NOT "Ativo";
                """);

            migrationBuilder.DropColumn(
                name: "Ativo",
                table: "publicadores");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Ativo",
                table: "publicadores",
                type: "boolean",
                nullable: false,
                // Quem foi desativado não é recuperável: todos voltam ativos.
                defaultValue: true);
        }
    }
}
