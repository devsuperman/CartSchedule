using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveStatusSolicitacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fase 11: não há mais aprovação — toda solicitação existente conta na escala e o
            // admin tira alguém excluindo o registro. As Rejeitadas (Status 3) já estavam fora
            // da escala, então são apagadas antes de a coluna sumir (senão voltariam a contar).
            migrationBuilder.Sql("DELETE FROM solicitacoes WHERE \"Status\" = 3;");

            migrationBuilder.DropColumn(
                name: "DecididoEm",
                table: "solicitacoes");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "solicitacoes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Tudo volta como Aprovada (2); as Rejeitadas apagadas no Up não voltam.
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DecididoEm",
                table: "solicitacoes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "solicitacoes",
                type: "integer",
                nullable: false,
                defaultValue: 2);
        }
    }
}
