module tb;
  reg [3:0] value;
  integer i;
  initial begin
    for (i = 0; i < 7; i = i + 1) begin
      case (i)
        0: value = 4'b0000;
        1: value = 4'b1111;
        2: value = 4'b1011;
        3: value = 4'b0xzz;
        4: value = 4'b1xzz;
        5: value = 4'bxxxx;
        6: value = 4'bzzzz;
      endcase
      $display("%b and=%b nand=%b or=%b nor=%b xor=%b xnor=%b/%b", value, &value, ~&value, |value, ~|value, ^value, ~^value, ^~value);
    end
    $finish;
  end
endmodule
