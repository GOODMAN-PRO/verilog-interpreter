module tb;
  reg [7:0] a, b, sum, average_narrow;
  reg carry;
  reg [8:0] sum_wide, average_wide;
  reg [15:0] wide;
  initial begin
    a = 200;
    b = 100;
    {carry, sum} = a + b;
    sum_wide = a + b;
    average_narrow = (a + b) >> 1;
    average_wide = (a + b) >> 1;
    wide = (a + b) << 2;
    $display("capture %b %0d wide=%0d", carry, sum, sum_wide);
    $display("average narrow=%0d wide=%0d", average_narrow, average_wide);
    $display("self sum=%0d shifted=%0d", a+b, (a+b)>>1);
    $display("leftshift wide=%0d self=%0d", wide, (a+b)<<2);
    $finish;
  end
endmodule
