module tb;
  reg signed [15:0] descending;
  reg [0:15] ascending;
  reg [20:5] offset;
  initial begin
    descending = 16'h9a6c;
    ascending = descending;
    offset = descending;
    $display("parts %h %h %h", descending[11:4], ascending[4:11], offset[16:9]);
    $display("bits %b %b %b", descending[15], ascending[0], offset[20]);
    $display("selected_unsigned %b %b", descending[15:8] < 8'sd0, descending < 16'sd0);
    descending[11:4] = 8'h3f;
    ascending[4:11] = 8'h3f;
    offset[16:9] = 8'h3f;
    $display("assigned %h %h %h", descending, ascending, offset);
    $finish;
  end
endmodule
