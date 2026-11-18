module tb;
  reg [3:0] a, b;
  reg signed [3:0] negative;
  reg signed [7:0] signed_other;
  reg [7:0] unsigned_other;
  reg [8:0] selected_sum;
  reg [15:0] signed_branch, mixed_branch;
  reg condition;
  initial begin
    a = 13;
    b = 7;
    negative = -2;
    signed_other = -3;
    unsigned_other = 8'h80;
    condition = 1;
    selected_sum = condition ? a+b : 4'd0;
    signed_branch = condition ? negative : signed_other;
    mixed_branch = condition ? negative : unsigned_other;
    $display("ternary sum=%0d signed=%h mixed=%h", selected_sum, signed_branch, mixed_branch);
    $display("comparison_context %b %b %b", (a+b) == 8'd20, (a+b) > 8'd16, {a+b} == 8'd20);
    condition = 1'bx;
    signed_branch = condition ? negative : signed_other;
    mixed_branch = condition ? negative : unsigned_other;
    $display("merged signed=%b mixed=%b", signed_branch, mixed_branch);
    $display("precedence %0d %0d %b %b", 2+3*4, (2+3)*4, 1'b1 | 1'b0 & 1'b0, (1'b1 | 1'b0) & 1'b0);
    $finish;
  end
endmodule
