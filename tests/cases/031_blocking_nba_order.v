module tb;
  reg [7:0] a, b, tmp, value;
  initial begin
    a = 8'd3;
    b = 8'd9;
    tmp = a;
    a = b;
    b = tmp;
    $display("blocking a=%0d b=%0d", a, b);
    a <= b;
    b <= a;
    $display("active a=%0d b=%0d", a, b);
    #0 $display("inactive a=%0d b=%0d", a, b);
    #1 $display("nba a=%0d b=%0d", a, b);
    value = 0;
    value <= 8'd4;
    value <= value + 8'd7;
    value <= 8'd12;
    #1 $display("ordered=%0d", value);
    $finish;
  end
endmodule