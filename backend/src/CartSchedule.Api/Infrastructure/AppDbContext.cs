using CartSchedule.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Publicador> Publicadores => Set<Publicador>();

    public DbSet<Carrinho> Carrinhos => Set<Carrinho>();

    public DbSet<Turno> Turnos => Set<Turno>();

    public DbSet<CarrinhoTurno> CarrinhoTurnos => Set<CarrinhoTurno>();

    public DbSet<Escala> Escalas => Set<Escala>();

    public DbSet<Solicitacao> Solicitacoes => Set<Solicitacao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Publicador>(entity =>
        {
            entity.ToTable("publicadores");
            entity.Property(p => p.Nome).IsRequired().HasMaxLength(200);
        });

        modelBuilder.Entity<Carrinho>(entity =>
        {
            entity.ToTable("carrinhos");
            entity.Property(c => c.Nome).IsRequired().HasMaxLength(200);
            entity.Property(c => c.Descricao).HasMaxLength(500);
        });

        modelBuilder.Entity<Turno>(entity =>
        {
            entity.ToTable("turnos");
        });

        modelBuilder.Entity<CarrinhoTurno>(entity =>
        {
            entity.ToTable("carrinho_turnos");
            entity.HasKey(ct => new { ct.CarrinhoId, ct.TurnoId });

            entity.HasOne(ct => ct.Carrinho)
                .WithMany(c => c.CarrinhoTurnos)
                .HasForeignKey(ct => ct.CarrinhoId);

            entity.HasOne(ct => ct.Turno)
                .WithMany(t => t.CarrinhoTurnos)
                .HasForeignKey(ct => ct.TurnoId);
        });

        modelBuilder.Entity<Escala>(entity =>
        {
            entity.ToTable("escalas");
            entity.HasIndex(e => e.MesReferencia).IsUnique();
        });

        modelBuilder.Entity<Solicitacao>(entity =>
        {
            entity.ToTable("solicitacoes");

            entity.HasOne(s => s.Publicador)
                .WithMany(p => p.Solicitacoes)
                .HasForeignKey(s => s.PublicadorId);

            entity.HasOne(s => s.Escala)
                .WithMany(e => e.Solicitacoes)
                .HasForeignKey(s => s.EscalaId);

            entity.HasOne(s => s.Carrinho)
                .WithMany(c => c.Solicitacoes)
                .HasForeignKey(s => s.CarrinhoId);

            entity.HasOne(s => s.Turno)
                .WithMany(t => t.Solicitacoes)
                .HasForeignKey(s => s.TurnoId);

            // Regra 10 (PLANNING.md) — único bloqueio automático do sistema.
            entity.HasIndex(s => new { s.PublicadorId, s.EscalaId, s.CarrinhoId, s.DiaSemana, s.TurnoId })
                .IsUnique();

            // Usado tanto para montar os grupos de aprovação quanto a grade final (TECHNICAL_SPEC.md §4).
            entity.HasIndex(s => new { s.EscalaId, s.CarrinhoId, s.DiaSemana, s.TurnoId });
        });

        SeedTurnos(modelBuilder);
    }

    private static void SeedTurnos(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Turno>().HasData(
            new Turno { Id = 1, HoraInicio = new TimeOnly(6, 0), HoraFim = new TimeOnly(8, 0) },
            new Turno { Id = 2, HoraInicio = new TimeOnly(8, 0), HoraFim = new TimeOnly(10, 0) },
            new Turno { Id = 3, HoraInicio = new TimeOnly(10, 0), HoraFim = new TimeOnly(12, 0) },
            new Turno { Id = 4, HoraInicio = new TimeOnly(14, 0), HoraFim = new TimeOnly(16, 0) },
            new Turno { Id = 5, HoraInicio = new TimeOnly(16, 0), HoraFim = new TimeOnly(18, 0) },
            new Turno { Id = 6, HoraInicio = new TimeOnly(18, 0), HoraFim = new TimeOnly(20, 0) }
        );
    }
}
