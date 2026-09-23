using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSolicitacoesCanceladas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Status 4 era "Cancelada", removido do enum na Fase 5 (exclusão
            // substitui o cancelamento). Apagar as linhas também libera o
            // índice único de duplicidade para o publicador re-solicitar.
            migrationBuilder.Sql("DELETE FROM solicitacoes WHERE \"Status\" = 4;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sem Down de dados: as solicitações canceladas apagadas não voltam.
        }
    }
}
