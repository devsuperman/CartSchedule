using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EscalaEnvioFechado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EnvioFechado",
                table: "escalas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Pela regra antiga (fechamento automático no dia 27) as escalas que já existem
            // estão fechadas; sem isto, a do próximo mês reabriria sozinha no deploy. Se o
            // administrador quiser, reabre pela tela da Escala.
            migrationBuilder.Sql("UPDATE escalas SET \"EnvioFechado\" = true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EnvioFechado",
                table: "escalas");
        }
    }
}
