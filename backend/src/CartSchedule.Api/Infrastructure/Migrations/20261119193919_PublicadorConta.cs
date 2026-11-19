using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PublicadorConta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Administrador",
                table: "publicadores",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Ativo",
                table: "publicadores",
                type: "boolean",
                nullable: false,
                // Os registros que já existem viram contas ativas (ADR 0001).
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "PinHash",
                table: "publicadores",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Usuario",
                table: "publicadores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UsuarioNormalizado",
                table: "publicadores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VersaoSessao",
                table: "publicadores",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_publicadores_UsuarioNormalizado",
                table: "publicadores",
                column: "UsuarioNormalizado",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_publicadores_UsuarioNormalizado",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "Administrador",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "Ativo",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "PinHash",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "Usuario",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "UsuarioNormalizado",
                table: "publicadores");

            migrationBuilder.DropColumn(
                name: "VersaoSessao",
                table: "publicadores");
        }
    }
}
