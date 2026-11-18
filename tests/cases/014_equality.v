module tb;
  reg [3:0] a, b;
  integer i;
  initial begin
    a = 4'b10xz;
    for (i = 0; i < 5; i = i + 1) begin
      case (i)
        0: b = 4'b10xz;
        1: b = 4'b10zx;
        2: b = 4'b11xz;
        3: b = 4'b1000;
        4: b = 4'b0000;
      endcase
      $display("%b %b eq=%b ne=%b caseeq=%b casene=%b", a, b, a == b, a != b, a === b, a !== b);
    end
    a = 4'b1010;
    b = 4'b1010;
    $display("known %b %b %b %b", a == b, a != b, a === b, a !== b);
    $finish;
  end
endmodule
