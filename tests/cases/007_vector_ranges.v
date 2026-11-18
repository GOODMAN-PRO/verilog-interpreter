module tb;
  reg [7:0] descending;
  reg [0:7] ascending;
  reg [12:5] offset_down;
  reg [-3:4] offset_up;
  integer i;
  initial begin
    descending = 8'b10100110;
    ascending = descending;
    offset_down = descending;
    offset_up = descending;
    $display("whole %b %b %b %b", descending, ascending, offset_down, offset_up);
    $display("ends %b%b %b%b %b%b %b%b", descending[7], descending[0], ascending[0], ascending[7], offset_down[12], offset_down[5], offset_up[-3], offset_up[4]);
    for (i = 0; i < 8; i = i + 1)
      $display("index %0d %b %b %b %b", i, descending[i], ascending[i], offset_down[i+5], offset_up[i-3]);
    $finish;
  end
endmodule
