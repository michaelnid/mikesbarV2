namespace Backend.Models.DTO;

public class ChangePinRequest
{
    public required string OldPin { get; set; }
    public required string NewPin { get; set; }
}
