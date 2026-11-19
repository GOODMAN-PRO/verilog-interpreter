module t;
  function [7:0] f(input a);
    begin
      $display("on entry f=%b", f);
      if (a) f = 8'h55;
    end
  endfunction
  initial begin
    $display("%b", f(1));
    $display("%b", f(0));
  end
endmodule
