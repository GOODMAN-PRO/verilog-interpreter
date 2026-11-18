module tb;
  function [7:0] old_add;
    input [7:0] left, right;
    reg [8:0] wide;
    begin
      wide = left + right;
      old_add = wide[7:0];
    end
  endfunction
  function signed [8:0] ansi_add(input signed [7:0] left, input signed [7:0] right);
    begin
      ansi_add = left + right;
    end
  endfunction
  function integer ones(input [7:0] value);
    integer i;
    begin
      ones = 0;
      for (i = 0; i < 8; i = i + 1) ones = ones + value[i];
    end
  endfunction
  initial begin
    $display("old=%0d signed=%0d ones=%0d", old_add(250, 10), ansi_add(-100, -40), ones(8'ha6));
    $display("old=%0d signed=%0d ones=%0d", old_add(3, 4), ansi_add(-8, 12), ones(8'hff));
    $finish;
  end
endmodule