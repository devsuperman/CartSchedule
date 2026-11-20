#:package Microsoft.Extensions.Identity.Core@10.0.0
// Prints the PasswordHasher hash of the password given as the first argument
// (the format the API expects in Admin__SenhaHash).
using Microsoft.AspNetCore.Identity;

Console.Write(new PasswordHasher<object>().HashPassword(new object(), args[0]));
