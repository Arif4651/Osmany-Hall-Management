namespace HallBackend.Domain.Constants;

public static class Roles
{
    public const string Admin = "admin";
    public const string SuperAdmin = "super_admin";
    public const string MaleWingAdmin = "male_wing_admin";
    public const string FemaleWingAdmin = "female_wing_admin";
    public const string Student = "student";
    public const string HallAdministrators = Admin + "," + SuperAdmin + "," + MaleWingAdmin + "," + FemaleWingAdmin;
}
