using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PublicadorCriancaOuIdoso : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CriancaOuIdoso",
                table: "publicadores",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CriancaOuIdoso",
                table: "publicadores");
        }
    }
}
