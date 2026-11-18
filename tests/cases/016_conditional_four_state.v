module tb;
  reg [1:0] condition;
  reg [7:0] a, b;
  integer i;
  initial begin
    a = 8'b10xz_0101;
    b = 8'b10xz_0110;
    for (i = 0; i < 5; i = i + 1) begin
      case (i)
        0: condition = 2'b00;
        1: condition = 2'b01;
        2: condition = 2'b0x;
        3: condition = 2'bzz;
        4: condition = 2'b1x;
      endcase
      $display("condition=%b result=%b", condition, condition ? a : b);
    end
    $display("nested=%0d", 1'b0 ? 7 : 1'b1 ? 8 : 9);
    $finish;
  end
endmodule
