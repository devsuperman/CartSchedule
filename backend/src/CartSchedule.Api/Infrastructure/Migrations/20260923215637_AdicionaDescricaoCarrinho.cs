using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaDescricaoCarrinho : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Descricao",
                table: "carrinhos",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Descricao",
                table: "carrinhos");
        }
    }
}
