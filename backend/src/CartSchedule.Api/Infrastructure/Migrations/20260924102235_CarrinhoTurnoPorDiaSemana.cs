using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CarrinhoTurnoPorDiaSemana : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fase 6 (PLANNING.md regra 17): a configuração antiga (turno valendo para
            // todos os dias) é zerada — o admin reconfigura cada carrinho por dia da
            // semana. Solicitacao não referencia carrinho_turnos, então nada muda nela.
            migrationBuilder.Sql("DELETE FROM carrinho_turnos;");

            migrationBuilder.DropPrimaryKey(
                name: "PK_carrinho_turnos",
                table: "carrinho_turnos");

            migrationBuilder.AddColumn<int>(
                name: "DiaSemana",
                table: "carrinho_turnos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_carrinho_turnos",
                table: "carrinho_turnos",
                columns: new[] { "CarrinhoId", "DiaSemana", "TurnoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sem o dia, várias linhas virariam o mesmo (carrinho, turno) e a PK antiga
            // falharia — zera de novo em vez de tentar colapsar.
            migrationBuilder.Sql("DELETE FROM carrinho_turnos;");

            migrationBuilder.DropPrimaryKey(
                name: "PK_carrinho_turnos",
                table: "carrinho_turnos");

            migrationBuilder.DropColumn(
                name: "DiaSemana",
                table: "carrinho_turnos");

            migrationBuilder.AddPrimaryKey(
                name: "PK_carrinho_turnos",
                table: "carrinho_turnos",
                columns: new[] { "CarrinhoId", "TurnoId" });
        }
    }
}
